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

/** Attiva l'abbonamento Nexora: pagina di pagamento Stripe. */
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
  // Nexora incassa sul conto della piattaforma: niente conto collegato.
  if (await isNexoraTenant()) redirect("/admin/impostazioni");
  const s = stripe();
  let account = billing.stripe_account_id;
  if (!account) {
    const a = await s.accounts.create(
      {
        country: "IT",
        email: user.email,
        business_profile: { name: tenant.nome, url: origin },
        // Il cliente è il venditore: paga lui le commissioni Stripe, gestisce il suo conto
        // dalla sua dashboard, e Nexora non trattiene nulla.
        controller: {
          fees: { payer: "account" },
          losses: { payments: "stripe" },
          stripe_dashboard: { type: "full" },
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
  const link = await s.accountLinks.create({
    account,
    type: "account_onboarding",
    refresh_url: `${origin}/admin/impostazioni?stripe=riprova`,
    return_url: `${origin}/admin/impostazioni?stripe=ritorno`,
  });
  redirect(link.url);
}
