/**
 * Stripe: chiamate REST con versione API fissata, così la forma degli oggetti non cambia da sola.
 * Con la versione 2025-02-24.acacia esistono ancora invoice.charge e charge.invoice,
 * usati per collegare rimborsi e fatture (dalla versione "basil" sono stati sostituiti da invoice.payments).
 */
import type { FatturaStripe, MetodoIncasso, RigaStripe } from "./mappatura.ts";

export const STRIPE_API_VERSION = "2025-02-24.acacia";

export class ErroreTemporaneo extends Error {}
export class ErroreDefinitivo extends Error {}

// deno-lint-ignore no-explicit-any
type Json = any;

export class ClientStripe {
  constructor(private chiave: string, private fetchFn: typeof fetch = fetch) {}

  private async get(percorso: string, espandi: string[] = []): Promise<Json> {
    const q = espandi.map((e) => `expand[]=${encodeURIComponent(e)}`).join("&");
    const sep = percorso.includes("?") ? "&" : "?";
    return this.richiesta("GET", `${percorso}${q ? `${sep}${q}` : ""}`);
  }

  private async richiesta(metodo: string, percorso: string, corpo?: URLSearchParams): Promise<Json> {
    let res: Response;
    try {
      res = await this.fetchFn(`https://api.stripe.com/v1${percorso}`, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${this.chiave}`,
          "Stripe-Version": STRIPE_API_VERSION,
          ...(corpo ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body: corpo,
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ErroreTemporaneo("Stripe non raggiungibile");
    }
    const json = await res.json().catch(() => ({}));
    if (res.status === 429 || res.status >= 500) throw new ErroreTemporaneo(`Stripe ha risposto ${res.status}`);
    if (!res.ok) throw new ErroreDefinitivo(`Stripe: ${json?.error?.message ?? res.status}`);
    return json;
  }

  /** Fattura con righe, prodotti, sconti e pagamento espansi. */
  async fattura(id: string): Promise<Json> {
    const inv = await this.get(`/invoices/${encodeURIComponent(id)}`, [
      "charge",
      "discounts",
      "total_discount_amounts.discount",
      "lines.data.price.product",
    ]);
    // Le righe oltre le prime 10 vanno lette a pagine
    if (inv.lines?.has_more) {
      const tutte = [...inv.lines.data];
      let dopo = tutte[tutte.length - 1]?.id;
      while (dopo) {
        const pagina = await this.get(`/invoices/${encodeURIComponent(id)}/lines?limit=100&starting_after=${dopo}`, ["data.price.product"]);
        tutte.push(...pagina.data);
        dopo = pagina.has_more ? pagina.data[pagina.data.length - 1]?.id : null;
      }
      inv.lines.data = tutte;
      inv.lines.has_more = false;
    }
    return inv;
  }

  async charge(id: string): Promise<Json> {
    return this.get(`/charges/${encodeURIComponent(id)}`, ["refunds"]);
  }

  async customer(id: string): Promise<Json> {
    return this.get(`/customers/${encodeURIComponent(id)}`);
  }

  /** Aggiorna i metadata del Customer con i dati di fatturazione. */
  async aggiornaMetadataCustomer(id: string, metadata: Record<string, string>): Promise<void> {
    const corpo = new URLSearchParams();
    for (const [k, v] of Object.entries(metadata)) corpo.set(`metadata[${k}]`, v);
    await this.richiesta("POST", `/customers/${encodeURIComponent(id)}`, corpo);
  }
}

const metodoDaCharge = (charge: Json): MetodoIncasso => {
  const t = charge?.payment_method_details?.type;
  return t === "card" ? "carta" : t === "sepa_debit" ? "sepa" : "altro";
};

/** Dati Stripe → forma usata dalla mappatura (nessun dato superfluo). */
export function normalizzaFattura(inv: Json): FatturaStripe {
  const charge = inv.charge && typeof inv.charge === "object" ? inv.charge : null;
  const righe: RigaStripe[] = (inv.lines?.data ?? []).map((l: Json) => ({
    id: l.id,
    tipo: l.type,
    importo: l.amount,
    descrizione: l.description ?? null,
    quantita: l.quantity ?? null,
    periodo: l.period ? { inizio: l.period.start, fine: l.period.end } : null,
    proration: !!l.proration,
    prodotto: typeof l.price?.product === "object" ? l.price.product.name ?? null : null,
    sconti: (l.discount_amounts ?? []).map((d: Json) => ({ importo: d.amount, discount: typeof d.discount === "string" ? d.discount : d.discount?.id })),
    bollo: l.metadata?.bollo === "true",
  }));
  const sconti = (inv.total_discount_amounts ?? []).map((d: Json) => {
    const disc = typeof d.discount === "object" ? d.discount : null;
    const nome = disc?.coupon?.name || disc?.promotion_code?.code || disc?.coupon?.id || "coupon";
    return { importo: d.amount, discount: disc?.id ?? String(d.discount), nome };
  });
  return {
    id: inv.id,
    numero: inv.number ?? null,
    valuta: inv.currency,
    totale: inv.total,
    subtotale: inv.subtotal,
    tasse: inv.tax ?? null,
    importoPagato: inv.amount_paid,
    cliente: typeof inv.customer === "string" ? inv.customer : inv.customer?.id,
    righe,
    sconti,
    pagataIl: inv.status_transitions?.paid_at ?? null,
    metodo: charge ? metodoDaCharge(charge) : "altro",
    chargeId: charge?.id ?? (typeof inv.charge === "string" ? inv.charge : null),
  };
}
