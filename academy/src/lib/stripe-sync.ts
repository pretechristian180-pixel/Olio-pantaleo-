import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { planFromLookupKey, tenantStatusFromSubscription } from "@/lib/billing";

/**
 * Da Stripe al database. Ogni funzione è idempotente: webhook ripetuti o la pagina di ritorno
 * dal pagamento possono chiamarla più volte senza effetti doppi.
 */

function customerId(c: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  return typeof c === "string" ? c : (c?.id ?? null);
}

/** Abbonamento Nexora di un'academy: stato, piano e id Stripe. */
export async function syncTenantSubscription(sub: Stripe.Subscription) {
  const db = createAdminClient();
  const cust = customerId(sub.customer);
  let tenantId = sub.metadata?.tenant_id || null;
  if (!tenantId && cust) {
    const { data } = await db
      .from("tenants")
      .select("id")
      .eq("stripe_customer_id", cust)
      .maybeSingle();
    tenantId = data?.id ?? null;
  }
  if (!tenantId) throw new Error(`Abbonamento ${sub.id} senza academy collegata`);

  const { data: current } = await db
    .from("tenants")
    .select("stripe_subscription_id")
    .eq("id", tenantId)
    .maybeSingle();
  // Un vecchio abbonamento chiuso non deve sospendere l'academy che ne ha già uno nuovo.
  if (
    current?.stripe_subscription_id &&
    current.stripe_subscription_id !== sub.id &&
    ["canceled", "incomplete_expired"].includes(sub.status)
  )
    return;

  const codice = planFromLookupKey(sub.items.data[0]?.price.lookup_key);
  let pianoId: string | undefined;
  if (codice) {
    const { data } = await db
      .from("platform_plans")
      .select("id")
      .eq("codice", codice)
      .maybeSingle();
    pianoId = data?.id;
  }
  const { error } = await db
    .from("tenants")
    .update({
      stato: tenantStatusFromSubscription(sub.status),
      stripe_customer_id: cust,
      stripe_subscription_id: sub.id,
      ...(pianoId ? { piano_id: pianoId } : {}),
    })
    .eq("id", tenantId);
  if (error) throw new Error(`Academy non aggiornata: ${error.message}`);
}

/**
 * Conto Stripe Connect del cliente (Accounts v2): può incassare con carta?
 * Rilegge il conto da Stripe e aggiorna l'academy. Restituisce lo stato.
 */
export async function syncConnectAccount(accountId: string) {
  const account = await stripe().v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant"],
  });
  const attivi = account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
  const { error } = await createAdminClient()
    .from("tenants")
    .update({ stripe_pagamenti_attivi: attivi })
    .eq("stripe_account_id", accountId);
  if (error) throw new Error(`Conto Stripe non aggiornato: ${error.message}`);
  return attivi;
}

/**
 * Acquisto di un corso completato: ordine pagato e iscrizione dello studente.
 * Restituisce lo slug del corso se l'accesso è attivo.
 */
export async function fulfillCourseCheckout(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment" || session.payment_status !== "paid") return null;
  const orderId = session.metadata?.order_id;
  if (!orderId) return null;
  const db = createAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .select("id, user_id, course_id, stato, stripe_session_id, courses(slug)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Ordine non leggibile: ${error.message}`);
  if (!order || order.stripe_session_id !== session.id) return null;

  if (order.stato !== "pagato") {
    const pi =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    const { error: e1 } = await db
      .from("orders")
      .update({
        stato: "pagato",
        pagato_il: new Date().toISOString(),
        stripe_payment_intent_id: pi,
        importo_cents: session.amount_total ?? undefined,
      })
      .eq("id", order.id);
    if (e1) throw new Error(`Ordine non aggiornato: ${e1.message}`);
  }
  if (order.user_id && order.course_id) {
    const { error: e2 } = await db.from("enrollments").upsert(
      {
        user_id: order.user_id,
        course_id: order.course_id,
        fonte: "stripe",
        stripe_session_id: session.id,
        order_id: order.id,
      },
      { onConflict: "user_id,course_id", ignoreDuplicates: true },
    );
    if (e2) throw new Error(`Iscrizione non creata: ${e2.message}`);
  }
  const course = order.courses as unknown as { slug: string } | null;
  return course?.slug ?? null;
}

/** Pagamento non andato a buon fine o sessione scaduta: l'ordine resta tracciato come fallito. */
export async function failCourseCheckout(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;
  await createAdminClient()
    .from("orders")
    .update({ stato: "fallito" })
    .eq("id", orderId)
    .eq("stato", "in_attesa");
}

/** Un evento si elabora una sola volta. */
export async function alreadyProcessed(eventId: string) {
  const { data } = await createAdminClient()
    .from("stripe_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  return Boolean(data);
}

export async function markProcessed(eventId: string, tipo: string) {
  await createAdminClient()
    .from("stripe_events")
    .upsert({ id: eventId, tipo }, { onConflict: "id", ignoreDuplicates: true });
}
