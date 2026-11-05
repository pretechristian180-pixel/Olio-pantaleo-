import { optionalServerEnv } from "@/lib/env.server";
import { handleStripeWebhook } from "@/lib/stripe-webhook";

export const dynamic = "force-dynamic";

/** Eventi del conto Stripe di Nexora: abbonamenti delle academy e vendite dei corsi Nexora. */
export async function POST(request: Request) {
  return handleStripeWebhook(request, optionalServerEnv("STRIPE_WEBHOOK_SECRET"));
}
