/**
 * Accesso ai dati dell'agente. L'interfaccia permette di testare l'agente con un archivio in memoria;
 * in produzione si usa ArchivioSupabase (chiave di servizio, solo dentro le Edge Function).
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import type { ImpostazioniFiscali } from "./mappatura.ts";
import type { ProfiloFatturazione } from "./validazione.ts";
import { mascheraOggetto } from "./maschera.ts";

export type StatoJob =
  | "in_coda" | "in_lavorazione" | "emessa" | "inviata" | "accettata" | "scartata" | "errore" | "dati_mancanti" | "da_controllare";

export interface Job {
  id: string;
  tipo: "fattura" | "nota_credito";
  stripe_invoice_id: string;
  stripe_customer_id: string | null;
  stripe_charge_id: string | null;
  stripe_refund_id: string | null;
  importo_rimborso_cents: number | null;
  stato: StatoJob;
  tentativi: number;
  max_tentativi: number;
  fic_document_id: number | null;
  invoice_id: string | null;
}

export interface Documento {
  id: string;
  tipo: "fattura" | "nota_credito";
  stripe_invoice_id: string;
  stripe_customer_id: string;
  stripe_refund_id: string | null;
  fattura_originale_id: string | null;
  fic_document_id: number;
  numero: string | null;
  data: string | null;
  imponibile: number | null;
  iva: number | null;
  totale: number | null;
  stato_sdi: string | null;
  sdi_motivo: string | null;
  sdi_soluzione: string | null;
  sdi_codice: string | null;
  pdf_url: string | null;
  dry_run: boolean;
  inviata_at: string | null;
  esito_at: string | null;
  email_cliente_at: string | null;
}

export interface Avviso {
  tipo: "dati_mancanti" | "xml_non_valido" | "scarto_sdi" | "errore_dopo_tentativi" | "esito_in_ritardo" | "configurazione" | "importi_non_coerenti" | "riepilogo_settimanale";
  titolo: string;
  testo: string;
  job_id?: string | null;
  invoice_id?: string | null;
}

export interface AvvisoSalvato extends Avviso {
  id: string;
  created_at: string;
}

export interface Archivio {
  prendiJob(limite: number): Promise<Job[]>;
  aggiornaJob(id: string, patch: Partial<Job> & { ultimo_errore?: string | null; dettaglio?: unknown }): Promise<void>;
  riprova(id: string, errore: string): Promise<StatoJob>;
  profilo(customerId: string): Promise<(ProfiloFatturazione & { id?: string }) | null>;
  salvaProfilo(p: ProfiloFatturazione): Promise<void>;
  impostaFicCliente(customerId: string, ficId: number): Promise<void>;
  impostazioni(): Promise<ImpostazioniFiscali | null>;
  fatturaDi(stripeInvoiceId: string): Promise<Documento | null>;
  documentoPerFic(ficId: number): Promise<Documento | null>;
  salvaDocumento(d: Omit<Documento, "id">): Promise<Documento>;
  aggiornaDocumento(id: string, patch: Partial<Documento>): Promise<void>;
  avviso(a: Avviso): Promise<void>;
  avvisiDaInviare(): Promise<AvvisoSalvato[]>;
  segnaAvvisoInviato(id: string): Promise<void>;
  log(livello: "info" | "avviso" | "errore", operazione: string, riferimento: string | null, messaggio: string, dettagli?: unknown): Promise<void>;
  aggiornaJobPerFic(ficId: number, patch: Record<string, unknown>): Promise<void>;
  /** documenti inviati da più di N giorni ancora senza esito definitivo */
  documentiSenzaEsito(giorni: number): Promise<Documento[]>;
  esisteAvviso(tipo: Avviso["tipo"], invoiceId: string): Promise<boolean>;
  riepilogo(): Promise<Riepilogo>;
}

export interface Riepilogo {
  incassato: number;
  fatture: number;
  note_credito: number;
  scarti: number;
  job_da_gestire: number;
}

export class ArchivioSupabase implements Archivio {
  db: SupabaseClient;
  constructor() {
    this.db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
  }

  private async ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(`Database: ${(error as { message?: string }).message ?? "errore"}`);
    return data;
  }

  async prendiJob(limite: number) {
    return (await this.ok(this.db.rpc("prendi_job_fatturazione", { p_limite: limite }))) as Job[];
  }
  async aggiornaJob(id: string, patch: Record<string, unknown>) {
    await this.ok(this.db.from("invoice_jobs").update(patch).eq("id", id));
  }
  async riprova(id: string, errore: string) {
    return (await this.ok(this.db.rpc("riprova_job_fatturazione", { p_job: id, p_errore: errore }))) as StatoJob;
  }
  async profilo(customerId: string) {
    return await this.ok(this.db.from("billing_profiles").select("*").eq("stripe_customer_id", customerId).maybeSingle());
  }
  async salvaProfilo(p: ProfiloFatturazione) {
    await this.ok(this.db.from("billing_profiles").upsert(p, { onConflict: "stripe_customer_id" }));
  }
  async impostaFicCliente(customerId: string, ficId: number) {
    await this.ok(this.db.from("billing_profiles").update({ fic_client_id: ficId }).eq("stripe_customer_id", customerId));
  }
  async impostazioni() {
    return await this.ok(this.db.from("fiscal_settings").select("*").eq("id", 1).maybeSingle()) as ImpostazioniFiscali | null;
  }
  async fatturaDi(stripeInvoiceId: string) {
    return await this.ok(this.db.from("invoices").select("*").eq("stripe_invoice_id", stripeInvoiceId).eq("tipo", "fattura").maybeSingle()) as Documento | null;
  }
  async documentoPerFic(ficId: number) {
    return await this.ok(this.db.from("invoices").select("*").eq("fic_document_id", ficId).maybeSingle()) as Documento | null;
  }
  async salvaDocumento(d: Omit<Documento, "id">) {
    return await this.ok(this.db.from("invoices").upsert(d, { onConflict: "fic_document_id" }).select("*").single()) as Documento;
  }
  async aggiornaDocumento(id: string, patch: Partial<Documento>) {
    await this.ok(this.db.from("invoices").update(patch).eq("id", id));
  }
  async avviso(a: Avviso) {
    await this.ok(this.db.from("avvisi").insert(a));
  }
  async avvisiDaInviare() {
    return await this.ok(this.db.from("avvisi").select("*").is("email_inviata_at", null).neq("tipo", "riepilogo_settimanale").order("created_at").limit(50)) as AvvisoSalvato[];
  }
  async segnaAvvisoInviato(id: string) {
    await this.ok(this.db.from("avvisi").update({ email_inviata_at: new Date().toISOString() }).eq("id", id));
  }
  async aggiornaJobPerFic(ficId: number, patch: Record<string, unknown>) {
    await this.ok(this.db.from("invoice_jobs").update(patch).eq("fic_document_id", ficId));
  }
  async documentiSenzaEsito(giorni: number) {
    const limite = new Date(Date.now() - giorni * 86_400_000).toISOString();
    return await this.ok(this.db.from("invoices").select("*").in("stato_sdi", ["sent", "pending", "processing"]).lt("inviata_at", limite)) as Documento[];
  }
  async esisteAvviso(tipo: Avviso["tipo"], invoiceId: string) {
    const { count } = await this.db.from("avvisi").select("id", { count: "exact", head: true }).eq("tipo", tipo).eq("invoice_id", invoiceId);
    return (count ?? 0) > 0;
  }
  async riepilogo() {
    return await this.ok(this.db.from("riepilogo_settimana").select("*").single()) as Riepilogo;
  }
  async log(livello: "info" | "avviso" | "errore", operazione: string, riferimento: string | null, messaggio: string, dettagli?: unknown) {
    // Mai dati personali completi nei log: tutto passa dal mascheramento
    const sicuri = dettagli === undefined ? null : mascheraOggetto(dettagli);
    console.log(`[${livello}] ${operazione} ${riferimento ?? ""} ${messaggio}`);
    await this.db.from("operation_logs").insert({ livello, operazione, riferimento, messaggio, dettagli: sicuri });
  }
}
