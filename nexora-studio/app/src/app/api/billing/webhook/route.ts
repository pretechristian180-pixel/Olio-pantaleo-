import {
  BillingSignatureError,
  createBillingProvider,
  processBillingEvent,
} from "@nexora/shared/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook dei pagamenti (Stripe). Risponde 2xx solo a evento elaborato o già visto:
 * con un errore Stripe ripete l'invio. Firma verificata dall'adapter.
 */
export async function POST(request: Request) {
  const provider = createBillingProvider();
  if (!provider) return Response.json({ error: "Pagamenti non configurati" }, { status: 503 });

  const body = await request.text();
  const signature =
    request.headers.get("stripe-signature") ?? request.headers.get("x-demo-signature");
  let event;
  try {
    event = await provider.parseWebhook(body, signature);
  } catch (e) {
    if (e instanceof BillingSignatureError)
      return Response.json({ error: "Firma non valida" }, { status: 400 });
    throw e;
  }

  try {
    const result = await processBillingEvent(createAdminClient(), provider, event, {
      appUrl: publicEnv.appUrl,
    });
    return Response.json({ received: true, result });
  } catch (e) {
    console.error("webhook pagamenti", event.type, event.id, e);
    return Response.json({ error: "Elaborazione non riuscita" }, { status: 500 });
  }
}
