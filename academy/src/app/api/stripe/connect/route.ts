import { optionalServerEnv } from "@/lib/env.server";
import { handleStripeWebhook } from "@/lib/stripe-webhook";

export const dynamic = "force-dynamic";

/** Eventi dei conti Stripe collegati dei clienti: onboarding e vendite dei loro corsi. */
export async function POST(request: Request) {
  return handleStripeWebhook(request, optionalServerEnv("STRIPE_CONNECT_WEBHOOK_SECRET"));
}
