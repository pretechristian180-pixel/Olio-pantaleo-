import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  alreadyProcessed,
  failCourseCheckout,
  fulfillCourseCheckout,
  markProcessed,
  syncConnectAccount,
  syncTenantSubscription,
} from "@/lib/stripe-sync";

/**
 * Riceve un webhook Stripe ed elabora l'evento una sola volta.
 * "platform" = eventi del conto Christian Prete Academy (abbonamenti, vendite dei corsi di Christian Prete);
 * "connect" = eventi dei conti dei clienti (onboarding, vendite dei loro corsi).
 *
 * Autenticità: con il segreto di firma configurato verifichiamo la firma; senza, rileggiamo
 * l'evento da Stripe con la nostra chiave (metodo indicato da Stripe), così un evento finto
 * inviato da altri viene scartato.
 */
export async function handleStripeWebhook(request: Request, secret: string | undefined) {
  const body = await request.text();
  let event: Stripe.Event;
  if (secret) {
    const signature = request.headers.get("stripe-signature");
    if (!signature) return new Response("Firma mancante", { status: 400 });
    try {
      event = await stripe().webhooks.constructEventAsync(body, signature, secret);
    } catch {
      return new Response("Firma non valida", { status: 400 });
    }
  } else {
    const fetched = await fetchEventFromStripe(body);
    if (!fetched) return new Response("Evento non riconosciuto", { status: 400 });
    event = fetched;
  }
  if (await alreadyProcessed(event.id)) return Response.json({ ok: true, duplicato: true });
  try {
    await processEvent(event);
  } catch (e) {
    console.error("Stripe webhook", event.type, event.id, e);
    // 500: Stripe riprova più tardi.
    return new Response("Errore temporaneo", { status: 500 });
  }
  await markProcessed(event.id, event.type);
  return Response.json({ ok: true });
}

async function fetchEventFromStripe(body: string): Promise<Stripe.Event | null> {
  let parsed: { id?: unknown; account?: unknown };
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const id =
    typeof parsed.id === "string" && /^evt_[A-Za-z0-9]+$/.test(parsed.id) ? parsed.id : null;
  const account =
    typeof parsed.account === "string" && /^acct_[A-Za-z0-9]+$/.test(parsed.account)
      ? parsed.account
      : undefined;
  if (!id) return null;
  try {
    return await stripe().events.retrieve(id, undefined, { stripeAccount: account });
  } catch {
    return null;
  }
}

async function processEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.mode === "subscription" && typeof s.subscription === "string") {
        await syncTenantSubscription(await stripe().subscriptions.retrieve(s.subscription));
      } else if (s.mode === "payment") {
        await fulfillCourseCheckout(s);
      }
      break;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await failCourseCheckout(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      // Rileggiamo l'abbonamento: gli eventi possono arrivare in disordine.
      if (!event.account)
        await syncTenantSubscription(await stripe().subscriptions.retrieve(event.data.object.id));
      break;
    case "account.updated":
      await syncConnectAccount(event.data.object.id);
      break;
  }
}
