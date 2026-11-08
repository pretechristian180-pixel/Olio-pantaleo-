"use server";

import { redirect } from "next/navigation";
import { requireTenantAdmin } from "@/lib/auth";
import {
  lookupKeyFor,
  originFromHost,
  PLAN_CODES,
  trialEndFor,
  type PlanCode,
} from "@/lib/billing";
import { isStripeConfigured, stripe, taxRateIds } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenant, isNexoraTenant, requestHost } from "@/lib/tenant";

async function context() {
  const user = await requireTenantAdmin();
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/admin");
  if (!isStripeConfigured()) redirect("/admin/impostazioni?stripe=non-configurato");
  const origin = originFromHost(await requestHost());
  if (!origin) redirect("/admin/impostazioni");
  const { data: billing } = await createAdminClient()
    .from("tenants")
    .select("stripe_customer_id, stripe_subscription_id, stripe_account_id")
    .eq("id", tenant.id)
    .single();
  return { user, tenant, origin, billing: billing! };
}

/** Attiva l'abbonamento Christian Prete Academy: pagina di pagamento Stripe. */
export async function startSubscription(formData: FormData) {
  const { user, tenant, origin, billing } = await context();
  const piano = String(formData.get("piano") ?? tenant.piano?.codice ?? "start") as PlanCode;
  const intervallo = formData.get("intervallo") === "anno" ? "anno" : "mese";
  if (!PLAN_CODES.includes(piano)) redirect("/admin/impostazioni");
  if (billing.stripe_subscription_id) return openBillingPortal();

  const s = stripe();
  const prices = await s.prices.list({
    lookup_keys: [lookupKeyFor(piano, intervallo)],
    active: true,
  });
  const price = prices.data[0];
  if (!price) throw new Error(`Prezzo ${piano}/${intervallo} non trovato su Stripe`);

  let customer = billing.stripe_customer_id;
  if (!customer) {
    const c = await s.customers.create(
      {
        name: tenant.nome,
        email: user.email,
        preferred_locales: ["it"],
        metadata: { tenant_id: tenant.id, slug: tenant.slug },
      },
      { idempotencyKey: `nx-customer-${tenant.id}` },
    );
    customer = c.id;
    await createAdminClient()
      .from("tenants")
      .update({ stripe_customer_id: customer })
      .eq("id", tenant.id);
  }

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: tenant.id,
    line_items: [{ price: price.id, quantity: 1, tax_rates: taxRateIds() }],
    subscription_data: {
      metadata: { tenant_id: tenant.id },
      trial_end: tenant.stato === "prova" ? trialEndFor(tenant.provaFineIl) : undefined,
    },
    // Ragione sociale e partita IVA in fattura.
    tax_id_collection: { enabled: true },
    billing_address_collection: "required",
    customer_update: { name: "auto", address: "auto" },
    allow_promotion_codes: true,
    locale: "it",
    metadata: { tenant_id: tenant.id },
    success_url: `${origin}/admin/impostazioni?abbonamento=ok`,
    cancel_url: `${origin}/admin/impostazioni`,
  });
  redirect(session.url!);
}

/** Fatture, carta, cambio piano o disdetta: portale clienti di Stripe. */
export async function openBillingPortal() {
  const { origin, billing } = await context();
  if (!billing.stripe_customer_id) redirect("/admin/impostazioni");
  const portal = await stripe().billingPortal.sessions.create({
    customer: billing.stripe_customer_id,
    locale: "it",
    return_url: `${origin}/admin/impostazioni`,
  });
  redirect(portal.url);
}

/** Collega il conto Stripe del cliente (Connect), dove arrivano i pagamenti dei suoi studenti. */
export async function connectStripe() {
  const { user, tenant, origin, billing } = await context();
  // Christian Prete Academy incassa sul conto della piattaforma: niente conto collegato.
  if (await isNexoraTenant()) redirect("/admin/impostazioni");
  const s = stripe();
  let account = billing.stripe_account_id;
  if (!account) {
    // Accounts v2: il cliente è il venditore (configurazione "merchant"), usa la sua dashboard
    // Stripe completa e paga lui le commissioni Stripe. Christian Prete Academy non trattiene nulla.
    const a = await s.v2.core.accounts.create(
      {
        display_name: tenant.nome,
        contact_email: user.email,
        identity: { country: "IT" },
        dashboard: "full",
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
        defaults: {
          currency: "eur",
          locales: ["it-IT"],
          responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
        },
        metadata: { tenant_id: tenant.id, slug: tenant.slug },
      },
      { idempotencyKey: `nx-account-${tenant.id}` },
    );
    account = a.id;
    await createAdminClient()
      .from("tenants")
      .update({ stripe_account_id: account })
      .eq("id", tenant.id);
  }
  const link = await s.v2.core.accountLinks.create({
    account,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        refresh_url: `${origin}/admin/impostazioni?stripe=riprova`,
        return_url: `${origin}/admin/impostazioni?stripe=ritorno`,
      },
    },
  });
  redirect(link.url);
}
