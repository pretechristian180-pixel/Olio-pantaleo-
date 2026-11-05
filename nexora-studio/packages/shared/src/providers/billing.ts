/**
 * Adapter dei pagamenti (Stripe in produzione, "demo" per sviluppo e test).
 * Il resto del codice vede solo questi tipi: niente oggetti Stripe fuori dall'adapter.
 */

export type BillingInterval = "month" | "year";

/** Stato dell'abbonamento salvato in workspaces.subscription_status. */
export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";

/** Fotografia dell'abbonamento presso il fornitore. */
export interface SubscriptionSnapshot {
  id: string;
  customerId: string;
  /** Stato del fornitore già tradotto nel nostro. */
  status: Exclude<SubscriptionStatus, "trial">;
  priceId: string | null;
  interval: BillingInterval | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** Dai metadati impostati al checkout. */
  workspaceId: string | null;
}

export type BillingEvent =
  | { id: string; type: "checkout.completed"; workspaceId: string | null; customerId: string; subscriptionId: string }
  | {
      id: string;
      type: "subscription.changed";
      subscriptionId: string;
      /** Presente nell'evento; il servizio preferisce rileggere lo stato aggiornato dal fornitore. */
      subscription?: SubscriptionSnapshot;
    }
  | { id: string; type: "payment.succeeded"; customerId: string; subscriptionId: string | null }
  | { id: string; type: "payment.failed"; customerId: string; subscriptionId: string | null }
  | { id: string; type: "ignored"; providerType: string };

export interface CheckoutRequest {
  workspaceId: string;
  customerId: string | null;
  email: string;
  priceId: string;
  planId: string;
  interval: BillingInterval;
  /** Coupon permanente dei founding member. */
  couponId: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface BillingProvider {
  readonly name: string;
  /** Pagina di pagamento ospitata dal fornitore. */
  createCheckout(request: CheckoutRequest): Promise<{ url: string }>;
  /** Portale del cliente: carta, fatture, disdetta. */
  createPortal(customerId: string, returnUrl: string): Promise<{ url: string }>;
  /** Cambio piano su un abbonamento attivo (con conguaglio). */
  changePrice(subscriptionId: string, priceId: string): Promise<SubscriptionSnapshot | null>;
  /** Stato attuale (null se il fornitore non lo conserva, es. demo). */
  getSubscription(subscriptionId: string): Promise<SubscriptionSnapshot | null>;
  /** Verifica la firma e traduce l'evento. Lancia un errore se la firma non è valida. */
  parseWebhook(rawBody: string, signature: string | null): Promise<BillingEvent>;
}

export class BillingSignatureError extends Error {}

/** Traduzione degli stati Stripe nei nostri. */
export function mapProviderStatus(status: string): SubscriptionSnapshot["status"] {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "unpaid"; // unpaid, paused, stati futuri: niente nuovi montaggi
  }
}
