import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import Stripe from "stripe";

import {
  type BillingEvent,
  type BillingInterval,
  type BillingProvider,
  BillingSignatureError,
  type CheckoutRequest,
  mapProviderStatus,
  type SubscriptionSnapshot,
} from "./billing.js";

type Env = Record<string, string | undefined>;

const ts = (s: number | null | undefined) => (s ? new Date(s * 1000) : null);
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

/** Stripe: dal 2025 il periodo sta sulle voci dell'abbonamento; prima sull'abbonamento. */
export function snapshotFromStripe(sub: Stripe.Subscription): SubscriptionSnapshot {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number }) | undefined;
  const legacy = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const interval = item?.price?.recurring?.interval;
  return {
    id: sub.id,
    customerId: idOf(sub.customer as string | { id: string })!,
    status: mapProviderStatus(sub.status),
    priceId: item?.price?.id ?? null,
    interval: interval === "month" ? "month" : interval === "year" ? "year" : null,
    periodStart: ts(item?.current_period_start ?? legacy.current_period_start),
    periodEnd: ts(item?.current_period_end ?? legacy.current_period_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    workspaceId: sub.metadata?.workspace_id ?? null,
  };
}

/** Abbonamento collegato a una fattura (nuovo formato `parent`, o il vecchio campo diretto). */
function invoiceSubscription(inv: Stripe.Invoice): string | null {
  const parent = (inv as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } }).parent;
  const legacy = (inv as unknown as { subscription?: string | { id: string } }).subscription;
  return idOf(parent?.subscription_details?.subscription ?? legacy ?? null);
}

export class StripeBillingProvider implements BillingProvider {
  readonly name = "stripe";
  private stripe: Stripe;

  constructor(
    secretKey: string,
    private webhookSecret: string,
  ) {
    this.stripe = new Stripe(secretKey, { appInfo: { name: "Christian Prete Studio" }, maxNetworkRetries: 2 });
  }

  async createCheckout(r: CheckoutRequest) {
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: r.priceId, quantity: 1 }],
      ...(r.customerId
        ? { customer: r.customerId, customer_update: { name: "auto", address: "auto" } }
        : { customer_email: r.email }),
      client_reference_id: r.workspaceId,
      subscription_data: { metadata: { workspace_id: r.workspaceId, plan_id: r.planId } },
      metadata: { workspace_id: r.workspaceId },
      ...(r.couponId ? { discounts: [{ coupon: r.couponId }] } : { allow_promotion_codes: true }),
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      locale: "it",
      success_url: r.successUrl,
      cancel_url: r.cancelUrl,
    });
    if (!session.url) throw new Error("Stripe non ha restituito la pagina di pagamento");
    return { url: session.url };
  }

  async createPortal(customerId: string, returnUrl: string) {
    const session = await this.stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl, locale: "it" });
    return { url: session.url };
  }

  async changePrice(subscriptionId: string, priceId: string) {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    const item = sub.items.data[0];
    if (!item) throw new Error("Abbonamento senza voci");
    const updated = await this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "always_invoice",
      cancel_at_period_end: false,
    });
    return snapshotFromStripe(updated);
  }

  async getSubscription(subscriptionId: string) {
    try {
      return snapshotFromStripe(await this.stripe.subscriptions.retrieve(subscriptionId));
    } catch (e) {
      if ((e as { code?: string }).code === "resource_missing") return null;
      throw e;
    }
  }

  async parseWebhook(rawBody: string, signature: string | null): Promise<BillingEvent> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature ?? "", this.webhookSecret);
    } catch {
      throw new BillingSignatureError("Firma del webhook non valida");
    }
    const obj = event.data.object as unknown;
    switch (event.type) {
      case "checkout.session.completed": {
        const s = obj as Stripe.Checkout.Session;
        if (s.mode !== "subscription" || !s.subscription || !s.customer) break;
        return {
          id: event.id,
          type: "checkout.completed",
          workspaceId: s.client_reference_id ?? s.metadata?.workspace_id ?? null,
          customerId: idOf(s.customer as string | { id: string })!,
          subscriptionId: idOf(s.subscription as string | { id: string })!,
        };
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const sub = obj as Stripe.Subscription;
        return { id: event.id, type: "subscription.changed", subscriptionId: sub.id, subscription: snapshotFromStripe(sub) };
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const inv = obj as Stripe.Invoice;
        return {
          id: event.id,
          type: event.type === "invoice.paid" ? "payment.succeeded" : "payment.failed",
          customerId: idOf(inv.customer as string | { id: string })!,
          subscriptionId: invoiceSubscription(inv),
        };
      }
    }
    return { id: event.id, type: "ignored", providerType: event.type };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Demo: nessun pagamento reale. Il "checkout" è un link firmato verso l'app, che attiva
// l'abbonamento; i webhook di prova sono JSON firmati con HMAC (header x-demo-signature).
// ───────────────────────────────────────────────────────────────────────────

export function demoSign(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface DemoCheckoutToken {
  workspaceId: string;
  customerId: string;
  priceId: string;
  interval: BillingInterval;
  exp: number;
}

export function demoPeriodEnd(start: Date, interval: BillingInterval) {
  const end = new Date(start);
  if (interval === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

export class DemoBillingProvider implements BillingProvider {
  readonly name = "demo";

  constructor(
    private secret: string,
    private appUrl: string,
  ) {}

  async createCheckout(r: CheckoutRequest) {
    const token: DemoCheckoutToken = {
      workspaceId: r.workspaceId,
      customerId: r.customerId ?? `cus_demo_${randomUUID().slice(0, 8)}`,
      priceId: r.priceId,
      interval: r.interval,
      exp: Date.now() + 30 * 60_000,
    };
    const body = Buffer.from(JSON.stringify(token)).toString("base64url");
    return { url: `${this.appUrl}/api/billing/demo?t=${body}.${demoSign(body, this.secret)}` };
  }

  /** Legge un link di checkout demo (null se manomesso o scaduto). */
  readCheckoutToken(t: string): DemoCheckoutToken | null {
    const [body, sig] = t.split(".");
    if (!body || !sig || !safeEqual(sig, demoSign(body, this.secret))) return null;
    const token = JSON.parse(Buffer.from(body, "base64url").toString()) as DemoCheckoutToken;
    return token.exp > Date.now() ? token : null;
  }

  async createPortal(_customerId: string, returnUrl: string) {
    return { url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}portale=demo` };
  }

  async changePrice(subscriptionId: string, priceId: string): Promise<SubscriptionSnapshot | null> {
    // Il servizio completa il resto (cliente, periodo) dai dati salvati.
    return { id: subscriptionId, customerId: "", status: "active", priceId, interval: null, periodStart: null, periodEnd: null, cancelAtPeriodEnd: false, workspaceId: null };
  }

  async getSubscription() {
    return null;
  }

  async parseWebhook(rawBody: string, signature: string | null): Promise<BillingEvent> {
    if (!signature || !safeEqual(signature, demoSign(rawBody, this.secret))) {
      throw new BillingSignatureError("Firma del webhook non valida");
    }
    const e = JSON.parse(rawBody) as BillingEvent & { subscription?: SubscriptionSnapshot & { periodStart: string | null; periodEnd: string | null } };
    if (e.type === "subscription.changed" && e.subscription) {
      const s = e.subscription;
      return { ...e, subscription: { ...s, periodStart: s.periodStart ? new Date(s.periodStart) : null, periodEnd: s.periodEnd ? new Date(s.periodEnd) : null } };
    }
    return e;
  }
}

/** Fornitore dei pagamenti dall'ambiente; null se Stripe non è configurato. */
export function createBillingProvider(env: Env = process.env): BillingProvider | null {
  const kind = env.BILLING_PROVIDER ?? "stripe";
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (kind === "demo") {
    if (env.NODE_ENV === "production" && env.ALLOW_DEMO_PROVIDERS !== "true") {
      throw new Error("BILLING_PROVIDER=demo non è ammesso in produzione");
    }
    if (!env.STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET mancante (serve anche in demo)");
    return new DemoBillingProvider(env.STRIPE_WEBHOOK_SECRET, appUrl);
  }
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return null;
  return new StripeBillingProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET);
}
