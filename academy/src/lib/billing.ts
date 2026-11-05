/** Regole dei pagamenti, senza dipendenze: abbonamenti Nexora e vendita dei corsi. Testate. */

import type { TenantStatus } from "@/lib/tenant";

export const PLAN_CODES = ["start", "pro", "business"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];
export type BillingInterval = "mese" | "anno";

/** Chiave del prezzo su Stripe (lookup_key), creata una volta per piano e periodicità. */
export function lookupKeyFor(piano: PlanCode, intervallo: BillingInterval) {
  return `nexora_${piano}_${intervallo}`;
}

export function planFromLookupKey(key: string | null | undefined): PlanCode | null {
  const m = /^nexora_(start|pro|business)_(mese|anno)$/.exec(key ?? "");
  return (m?.[1] as PlanCode | undefined) ?? null;
}

/**
 * Stato dell'academy a partire dallo stato dell'abbonamento Stripe.
 * La prova gratuita resta "prova"; un pagamento non riuscito non spegne subito l'academy.
 */
export function tenantStatusFromSubscription(status: string): TenantStatus {
  switch (status) {
    case "active":
      return "attivo";
    case "trialing":
      return "prova";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "insoluto";
    case "paused":
    case "canceled":
    case "incomplete_expired":
    default:
      return "sospeso";
  }
}

/**
 * Fine della prova da passare a Stripe (secondi Unix), così chi attiva l'abbonamento durante la
 * prova non paga i giorni che gli restano. Stripe vuole almeno 48 ore nel futuro.
 */
export function trialEndFor(provaFineIl: string | null, now = Date.now()): number | undefined {
  if (!provaFineIl) return undefined;
  const end = new Date(provaFineIl).getTime();
  if (!Number.isFinite(end) || end - now < 48 * 3600 * 1000) return undefined;
  return Math.floor(end / 1000);
}

/** Origine (https://host) da cui l'utente sta usando la piattaforma, per i link di ritorno da Stripe. */
export function originFromHost(host: string | null | undefined) {
  const h = (host ?? "").trim().toLowerCase();
  if (!h) return null;
  const bare = h.replace(/:\d+$/, "");
  const local = bare === "localhost" || bare === "127.0.0.1" || bare.endsWith(".localhost");
  return `${local ? "http" : "https"}://${h}`;
}
