import { optionalServerEnv } from "@/lib/env.server";
import { handleStripeWebhook } from "@/lib/stripe-webhook";

export const dynamic = "force-dynamic";

/** Eventi del conto Stripe di Christian Prete Academy: abbonamenti delle academy e vendite dei corsi di Christian Prete. */
export async function POST(request: Request) {
  return handleStripeWebhook(request, optionalServerEnv("STRIPE_WEBHOOK_SECRET"));
}
