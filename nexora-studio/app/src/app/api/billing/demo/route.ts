import { randomUUID } from "node:crypto";

import {
  createBillingProvider,
  demoPeriodEnd,
  DemoBillingProvider,
  processBillingEvent,
} from "@nexora/shared/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checkout simulato (BILLING_PROVIDER=demo): il link firmato creato da "Scegli il piano"
 * attiva l'abbonamento come farebbero gli eventi Stripe, poi torna alla pagina del piano.
 */
export async function GET(request: Request) {
  const provider = createBillingProvider();
  if (!(provider instanceof DemoBillingProvider))
    return new Response("Non disponibile", { status: 404 });

  const token = provider.readCheckoutToken(new URL(request.url).searchParams.get("t") ?? "");
  if (!token) return new Response("Link di pagamento non valido o scaduto", { status: 400 });

  const db = createAdminClient();
  const opts = { appUrl: publicEnv.appUrl };
  const subscriptionId = `sub_demo_${randomUUID().slice(0, 12)}`;
  const start = new Date();
  await processBillingEvent(
    db,
    provider,
    {
      id: `evt_demo_${randomUUID()}`,
      type: "checkout.completed",
      workspaceId: token.workspaceId,
      customerId: token.customerId,
      subscriptionId,
    },
    opts,
  );
  await processBillingEvent(
    db,
    provider,
    {
      id: `evt_demo_${randomUUID()}`,
      type: "subscription.changed",
      subscriptionId,
      subscription: {
        id: subscriptionId,
        customerId: token.customerId,
        status: "active",
        priceId: token.priceId,
        interval: token.interval,
        periodStart: start,
        periodEnd: demoPeriodEnd(start, token.interval),
        cancelAtPeriodEnd: false,
        workspaceId: token.workspaceId,
      },
    },
    opts,
  );
  return Response.redirect(`${publicEnv.appUrl}/piano?attivato=1`, 303);
}
