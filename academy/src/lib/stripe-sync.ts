import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { parseBrand } from "@/lib/brand";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { purchaseConfirmation, saleNotification } from "@/lib/email-templates";
import { tenantUrl } from "@/lib/tenant-host";
import { formatPrice } from "@/lib/utils";
import { planFromLookupKey, tenantStatusFromSubscription } from "@/lib/billing";

/**
 * Da Stripe al database. Ogni funzione è idempotente: webhook ripetuti o la pagina di ritorno
 * dal pagamento possono chiamarla più volte senza effetti doppi.
 */

function customerId(c: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  return typeof c === "string" ? c : (c?.id ?? null);
}

/** Abbonamento Christian Prete Academy di un'academy: stato, piano e id Stripe. */
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
      // Chi attiva un abbonamento non è più in omaggio.
      ...(["active", "trialing"].includes(sub.status)
        ? { omaggio: false, omaggio_fine_il: null }
        : {}),
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

  let appenaPagato = false;
  if (order.stato !== "pagato") {
    const pi =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    // Aggiornamento condizionato: se webhook e pagina di ritorno arrivano insieme, solo uno
    // dei due "vince" e manda le email.
    const { data: updated, error: e1 } = await db
      .from("orders")
      .update({
        stato: "pagato",
        pagato_il: new Date().toISOString(),
        stripe_payment_intent_id: pi,
        importo_cents: session.amount_total ?? undefined,
      })
      .eq("id", order.id)
      .neq("stato", "pagato")
      .select("id");
    if (e1) throw new Error(`Ordine non aggiornato: ${e1.message}`);
    appenaPagato = Boolean(updated?.length);
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
  if (appenaPagato) await notifyPurchase(order.id).catch((e) => console.error("Email acquisto", e));
  const course = order.courses as unknown as { slug: string } | null;
  return course?.slug ?? null;
}

/** Email di conferma allo studente e avviso di vendita agli amministratori dell'academy. */
async function notifyPurchase(orderId: string) {
  const db = createAdminClient();
  const { data: o } = await db
    .from("orders")
    .select(
      "id, email, importo_cents, valuta, user_id, courses(titolo, slug), tenants(id, nome, slug, brand, dominio_personalizzato)",
    )
    .eq("id", orderId)
    .single();
  if (!o) return;
  const course = o.courses as unknown as { titolo: string; slug: string } | null;
  const tenant = o.tenants as unknown as {
    id: string;
    nome: string;
    slug: string;
    brand: unknown;
    dominio_personalizzato: string | null;
  } | null;
  if (!course || !tenant) return;
  const base = tenantBaseUrl(tenant.slug, tenant.dominio_personalizzato);
  const brand = { nome: tenant.nome, colore: parseBrand(tenant.brand).primary };
  const importo = formatPrice(o.importo_cents, o.valuta);
  const { data: profile } = o.user_id
    ? await db.from("profiles").select("nome, cognome").eq("id", o.user_id).maybeSingle()
    : { data: null };

  if (o.email) {
    await sendEmail({
      to: o.email,
      fromName: tenant.nome,
      content: purchaseConfirmation({
        brand,
        nome: profile?.nome ?? null,
        corso: course.titolo,
        importo,
        url: `${base}/app/corsi/${course.slug}`,
      }),
      idempotencyKey: `acquisto-${o.id}`,
    });
  }

  const { data: admins } = await db
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", tenant.id)
    .eq("ruolo", "admin");
  const emails: string[] = [];
  for (const a of admins ?? []) {
    const { data } = await db.auth.admin.getUserById(a.user_id);
    if (data.user?.email) emails.push(data.user.email);
  }
  if (emails.length) {
    const studente =
      [profile?.nome, profile?.cognome].filter(Boolean).join(" ") || o.email || "uno studente";
    await sendEmail({
      to: emails,
      content: saleNotification({
        brand,
        corso: course.titolo,
        importo,
        studente,
        url: `${base}/admin`,
      }),
      idempotencyKey: `vendita-${o.id}`,
    });
  }
}

function tenantBaseUrl(slug: string, dominio: string | null) {
  if (dominio) return `https://${dominio}`;
  const root = publicEnv.NEXT_PUBLIC_ROOT_DOMAIN;
  return slug === publicEnv.NEXT_PUBLIC_TENANT_SLUG ? `https://${root}` : tenantUrl(slug, root, "");
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
