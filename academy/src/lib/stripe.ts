import "server-only";
import Stripe from "stripe";
import { optionalServerEnv, requireServerEnv } from "@/lib/env.server";

let client: Stripe | null = null;

/** Client Stripe della piattaforma (chiave segreta, solo server). */
export function stripe() {
  client ??= new Stripe(requireServerEnv("STRIPE_SECRET_KEY"), {
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "Nexora Academy" },
  });
  return client;
}

/** Pagamenti pronti: chiave Stripe e chiave segreta Supabase (ordini e iscrizioni le scrive il server). */
export function isStripeConfigured() {
  return Boolean(
    optionalServerEnv("STRIPE_SECRET_KEY") && optionalServerEnv("SUPABASE_SECRET_KEY"),
  );
}

/** Aliquota IVA applicata agli abbonamenti Nexora (prezzi IVA esclusa). */
export function taxRateIds() {
  const id = optionalServerEnv("STRIPE_TAX_RATE_ID");
  return id ? [id] : undefined;
}
