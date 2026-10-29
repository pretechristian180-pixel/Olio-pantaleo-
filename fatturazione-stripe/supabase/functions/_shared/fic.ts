/**
 * Client minimo per l'API v2 di Fatture in Cloud (https://api-v2.fattureincloud.it).
 * Endpoint e campi verificati sull'SDK ufficiale @fattureincloud/fattureincloud-ts-sdk 2.1.3
 * (generato dallo spec OpenAPI): clients, issued_documents, e_invoice/xml_verify, e_invoice/send
 * (options.dry_run), e_invoice/error_reason, subscriptions e subscriptions/{id}/verify.
 */
import { ErroreDefinitivo, ErroreTemporaneo } from "./stripe.ts";

export const FIC_BASE = "https://api-v2.fattureincloud.it";
export const EVENTO_ESITO_SDI = "it.fattureincloud.webhooks.issued_documents.e_invoices.status_update";

// deno-lint-ignore no-explicit-any
type Json = any;

export interface EsitoVerificaXml {
  ok: boolean;
  errori: string[];
}

export class ClientFic {
  constructor(private token: string, private companyId: string, private fetchFn: typeof fetch = fetch) {}

  private url(percorso: string) {
    return `${FIC_BASE}/c/${encodeURIComponent(this.companyId)}${percorso}`;
  }

  async richiesta(metodo: string, percorso: string, corpo?: unknown, accettaErrore = false): Promise<{ status: number; json: Json }> {
    let res: Response;
    try {
      res = await this.fetchFn(this.url(percorso), {
        method: metodo,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ErroreTemporaneo("Fatture in Cloud non raggiungibile");
    }
    const json = await res.json().catch(() => ({}));
    if (res.status === 429 || res.status >= 500) throw new ErroreTemporaneo(`Fatture in Cloud ha risposto ${res.status}`);
    if (res.status === 401 || res.status === 403) {
      throw new ErroreDefinitivo("Token di Fatture in Cloud non valido o senza permessi (controlla FIC_ACCESS_TOKEN)");
    }
    if (!res.ok && !accettaErrore) {
      const msg = json?.error?.message ?? json?.message ?? `errore ${res.status}`;
      const dettagli = json?.error?.validation_result ? ` ${JSON.stringify(json.error.validation_result)}` : "";
      throw new ErroreDefinitivo(`Fatture in Cloud: ${msg}${dettagli}`);
    }
    return { status: res.status, json };
  }

  /** Cerca un cliente per P.IVA (o per codice fiscale se non c'è P.IVA). Filtro "q" dell'API. */
  async cercaCliente(partitaIva: string | null, codiceFiscale: string | null): Promise<Json | null> {
    const campo = partitaIva ? "vat_number" : "tax_code";
    const valore = (partitaIva ?? codiceFiscale ?? "").replace(/'/g, "");
    if (!valore) return null;
    const q = encodeURIComponent(`${campo} = '${valore}'`);
    const { json } = await this.richiesta("GET", `/entities/clients?fieldset=detailed&q=${q}`);
    return json?.data?.[0] ?? null;
  }

  async creaCliente(entity: Record<string, unknown>): Promise<Json> {
    const { json } = await this.richiesta("POST", "/entities/clients", { data: entity });
    return json.data;
  }

  async aggiornaCliente(id: number, entity: Record<string, unknown>): Promise<Json> {
    const { json } = await this.richiesta("PUT", `/entities/clients/${id}`, { data: entity });
    return json.data;
  }

  async creaDocumento(data: Record<string, unknown>): Promise<Json> {
    const { json } = await this.richiesta("POST", "/issued_documents", { data });
    return json.data;
  }

  async modificaDocumento(id: number, data: Record<string, unknown>): Promise<Json> {
    const { json } = await this.richiesta("PUT", `/issued_documents/${id}`, { data });
    return json.data;
  }

  async leggiDocumento(id: number): Promise<Json> {
    const { json } = await this.richiesta("GET", `/issued_documents/${id}?fieldset=detailed`);
    return json.data;
  }

  /**
   * Verifica dell'XML: 200 {data:{success:true}} se valido; in caso di errori la risposta contiene
   * error.validation_result.xml_errors e/o extra.errors (VerifyEInvoiceXmlErrorResponse).
   */
  async verificaXml(id: number): Promise<EsitoVerificaXml> {
    const { status, json } = await this.richiesta("GET", `/issued_documents/${id}/e_invoice/xml_verify`, undefined, true);
    if (status >= 200 && status < 300 && json?.data?.success !== false) return { ok: true, errori: [] };
    const errori = [
      ...(json?.error?.validation_result?.xml_errors ?? []),
      ...(json?.extra?.errors ?? []),
    ].map(String);
    if (!errori.length) errori.push(json?.error?.message ?? `Verifica non superata (codice ${status})`);
    return { ok: false, errori };
  }

  /** Invio allo SDI. Con dryRun=true Fatture in Cloud esegue i controlli ma NON invia (options.dry_run). */
  async inviaSdi(id: number, dryRun: boolean, dati?: { cassa_type?: string }): Promise<Json> {
    const { json } = await this.richiesta("POST", `/issued_documents/${id}/e_invoice/send`, {
      data: dati ?? {},
      options: { dry_run: dryRun },
    });
    return json.data;
  }

  /** Motivo dello scarto: reason, solution, code, ei_status, date. */
  async motivoScarto(id: number): Promise<Json> {
    const { json } = await this.richiesta("GET", `/issued_documents/${id}/e_invoice/error_reason`);
    return json.data;
  }

  async creaSubscription(sink: string): Promise<Json> {
    const { json } = await this.richiesta("POST", "/subscriptions", {
      data: { sink, types: [EVENTO_ESITO_SDI], verification_method: "header", config: { mapping: "binary" } },
    });
    return json.data;
  }

  async verificaSubscription(id: string): Promise<Json> {
    const { json } = await this.richiesta("POST", `/subscriptions/${encodeURIComponent(id)}/verify`, {
      data: { id, verification_method: "header" },
    });
    return json.data;
  }

  /** Per le impostazioni: tipi IVA e conti di incasso configurati su Fatture in Cloud. */
  async tipiIva(): Promise<Json[]> {
    return (await this.richiesta("GET", "/info/vat_types")).json?.data ?? [];
  }

  async contiIncasso(): Promise<Json[]> {
    return (await this.richiesta("GET", "/info/payment_accounts")).json?.data ?? [];
  }
}

/** Stati SDI (ei_status) → stato del job. */
export function statoJobDaSdi(ei: string | null | undefined): "inviata" | "accettata" | "scartata" | null {
  switch (ei) {
    case "accepted":
    case "manual_accepted":
    // Mancata consegna: la fattura è emessa e disponibile nel cassetto fiscale del cliente
    case "not_delivered":
      return "accettata";
    case "rejected":
    case "discarded":
    case "manual_rejected":
    case "error":
      return "scartata";
    case "sent":
    case "pending":
    case "processing":
    case "no_response":
      return "inviata";
    default:
      return null;
  }
}

export const ESITI_DEFINITIVI = ["accepted", "manual_accepted", "not_delivered", "rejected", "discarded", "manual_rejected", "error"];

/** Spiegazione in italiano dello stato SDI per avvisi e pannello. */
export function spiegaStatoSdi(ei: string | null | undefined): string {
  const m: Record<string, string> = {
    not_sent: "Non inviata (prova o in attesa)",
    sent: "Inviata allo SDI, in attesa di esito",
    pending: "In attesa di esito dallo SDI",
    processing: "In elaborazione allo SDI",
    accepted: "Consegnata al cliente",
    manual_accepted: "Accettata (segnata a mano)",
    not_delivered: "Mancata consegna: fattura valida, disponibile nel cassetto fiscale del cliente",
    no_response: "Nessuna risposta dal cliente (PA) entro i termini",
    rejected: "Rifiutata",
    discarded: "Scartata dallo SDI",
    manual_rejected: "Rifiutata (segnata a mano)",
    error: "Errore di invio",
  };
  return m[ei ?? ""] ?? (ei ? `Stato ${ei}` : "Sconosciuto");
}
