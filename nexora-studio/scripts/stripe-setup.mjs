#!/usr/bin/env node
// Prepara Stripe per Nexora Studio leggendo i piani dalla tabella `plans`:
//   - un prodotto per piano, prezzo mensile e annuale in EUR (ricorrenti)
//   - scrive gli id dei prezzi in plans.stripe_price_monthly_id / stripe_price_yearly_id
//   - (facoltativo) coupon permanente per i founding member
//   - (facoltativo) endpoint del webhook
//   - configurazione del portale clienti (carta, fatture, disdetta a fine periodo)
// Si può rilanciare: riusa prodotti e prezzi già creati (lookup_key) e crea solo ciò che manca.
//
// Uso (variabili nel tuo ambiente, mai nel codice):
//   STRIPE_SECRET_KEY=sk_test_... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... \
//     node scripts/stripe-setup.mjs [--founding-percent 20] [--webhook-url https://…/api/billing/webhook]
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Manca la variabile ${name}`);
    process.exit(1);
  }
  return v;
};

const stripe = new Stripe(need("STRIPE_SECRET_KEY"));
const db = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SECRET_KEY"), { auth: { persistSession: false } });
const live = process.env.STRIPE_SECRET_KEY.startsWith("sk_live");
console.log(`Stripe in modalità ${live ? "LIVE (pagamenti reali)" : "test"}`);

async function findPrice(lookupKey) {
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return data[0] ?? null;
}

async function ensurePrice(product, plan, interval, cents) {
  const key = `nexora_${plan.id}_${interval}`;
  const existing = await findPrice(key);
  if (existing && existing.unit_amount === cents && existing.currency === "eur") return existing;
  // Prezzo cambiato: nuovo prezzo con la stessa lookup_key (gli abbonati esistenti restano al vecchio).
  return stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: cents,
    recurring: { interval },
    lookup_key: key,
    transfer_lookup_key: Boolean(existing),
    tax_behavior: "exclusive",
    nickname: `${plan.name} ${interval === "month" ? "mensile" : "annuale"}`,
    metadata: { plan_id: plan.id },
  });
}

const { data: plans, error } = await db.from("plans").select("*").order("sort_order");
if (error) throw error;

for (const plan of plans) {
  const found = await stripe.products.search({ query: `metadata['plan_id']:'${plan.id}'` });
  const product =
    found.data[0] ??
    (await stripe.products.create({
      name: `Nexora Studio ${plan.name}`,
      description: `${plan.videos_per_month} video al mese, ${plan.social_accounts_max} social, ${plan.brands_max} brand`,
      metadata: { plan_id: plan.id },
    }));
  const monthly = await ensurePrice(product, plan, "month", plan.price_monthly_cents);
  const yearly = await ensurePrice(product, plan, "year", plan.price_yearly_cents);
  const { error: e } = await db
    .from("plans")
    .update({ stripe_price_monthly_id: monthly.id, stripe_price_yearly_id: yearly.id })
    .eq("id", plan.id);
  if (e) throw e;
  console.log(`✓ ${plan.name}: ${monthly.id} (mensile), ${yearly.id} (annuale)`);
}

const percent = arg("founding-percent");
if (percent) {
  const id = `nexora-founding-${percent}`;
  const coupon = await stripe.coupons.retrieve(id).catch(() => null) ??
    (await stripe.coupons.create({ id, name: `Founding member −${percent}%`, percent_off: Number(percent), duration: "forever" }));
  console.log(`✓ Coupon founding: ${coupon.id} → metti STRIPE_FOUNDING_COUPON_ID=${coupon.id}`);
}

const webhookUrl = arg("webhook-url");
if (webhookUrl) {
  const events = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
    "invoice.paid",
    "invoice.payment_failed",
  ];
  const { data: hooks } = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = hooks.find((h) => h.url === webhookUrl);
  if (existing) {
    await stripe.webhookEndpoints.update(existing.id, { enabled_events: events });
    console.log(`✓ Webhook già presente (${existing.id}): eventi aggiornati. Il segreto resta quello di prima.`);
  } else {
    const hook = await stripe.webhookEndpoints.create({ url: webhookUrl, enabled_events: events, description: "Nexora Studio" });
    console.log(`✓ Webhook creato. Metti nelle variabili d'ambiente: STRIPE_WEBHOOK_SECRET=${hook.secret}`);
  }
}

const { data: configs } = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
if (!configs.length) {
  await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Nexora Studio — pagamenti e fatture" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["name", "email", "address", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
  });
  console.log("✓ Portale clienti configurato");
} else {
  console.log("✓ Portale clienti già configurato");
}
console.log("Fatto.");
