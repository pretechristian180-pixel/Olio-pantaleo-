/**
 * Test end-to-end dell'agente con Stripe, Fatture in Cloud e Resend simulati (fetch finto)
 * e un archivio in memoria che riproduce le regole della coda (retry con backoff, max 5 tentativi).
 */
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import type { Archivio, Avviso, AvvisoSalvato, Documento, Job, Riepilogo, StatoJob } from "./archivio.ts";
import { aggiornaEsitoSdi, elaboraJob, type Dipendenze } from "./agente.ts";
import type { Config } from "./config.ts";
import { Postino } from "./email.ts";
import { ClientFic } from "./fic.ts";
import type { ImpostazioniFiscali } from "./mappatura.ts";
import { ClientStripe } from "./stripe.ts";
import type { ProfiloFatturazione } from "./validazione.ts";
import { fatturaStripe, impostazioniLordo, profilo } from "./esempi_test.ts";

// ---------- Archivio in memoria ----------
class ArchivioMemoria implements Archivio {
  jobs = new Map<string, Job & { ultimo_errore?: string | null; dettaglio?: unknown }>();
  profili = new Map<string, ProfiloFatturazione & { fic_client_id?: number | null }>();
  documenti: Documento[] = [];
  avvisi: AvvisoSalvato[] = [];
  logs: { livello: string; operazione: string; messaggio: string; dettagli?: unknown }[] = [];
  conf: ImpostazioniFiscali | null = { ...impostazioniLordo };

  async prendiJob() { return [...this.jobs.values()].filter((j) => j.stato === "in_coda"); }
  async aggiornaJob(id: string, patch: Record<string, unknown>) { Object.assign(this.jobs.get(id)!, patch); }
  async riprova(id: string, errore: string): Promise<StatoJob> {
    const j = this.jobs.get(id)!;
    j.ultimo_errore = errore;
    j.stato = j.tentativi < j.max_tentativi ? "in_coda" : "errore";
    if (j.stato === "errore") await this.avviso({ tipo: "errore_dopo_tentativi", titolo: "errore", testo: errore, job_id: id });
    return j.stato;
  }
  async profilo(c: string) { return this.profili.get(c) ?? null; }
  async salvaProfilo(p: ProfiloFatturazione) { this.profili.set(p.stripe_customer_id, { ...this.profili.get(p.stripe_customer_id), ...p }); }
  async impostaFicCliente(c: string, id: number) { this.profili.get(c)!.fic_client_id = id; }
  async impostazioni() { return this.conf; }
  async fatturaDi(s: string) { return this.documenti.find((d) => d.stripe_invoice_id === s && d.tipo === "fattura") ?? null; }
  async documentoPerFic(id: number) { return this.documenti.find((d) => d.fic_document_id === id) ?? null; }
  async salvaDocumento(d: Omit<Documento, "id">) { const n = { ...d, id: `doc_${this.documenti.length + 1}` }; this.documenti.push(n); return n; }
  async aggiornaDocumento(id: string, patch: Partial<Documento>) { Object.assign(this.documenti.find((d) => d.id === id)!, patch); }
  async avviso(a: Avviso) { this.avvisi.push({ ...a, id: `a${this.avvisi.length}`, created_at: new Date().toISOString() }); }
  async avvisiDaInviare() { return []; }
  async segnaAvvisoInviato() {}
  async log(livello: "info" | "avviso" | "errore", operazione: string, _r: string | null, messaggio: string, dettagli?: unknown) {
    this.logs.push({ livello, operazione, messaggio, dettagli });
  }
  async aggiornaJobPerFic(id: number, patch: Record<string, unknown>) { for (const j of this.jobs.values()) if (j.fic_document_id === id) Object.assign(j, patch); }
  async documentiSenzaEsito() { return []; }
  async esisteAvviso() { return false; }
  async riepilogo(): Promise<Riepilogo> { return { incassato: 0, fatture: 0, note_credito: 0, scarti: 0, job_da_gestire: 0 }; }
}

// ---------- Servizi simulati ----------
interface Chiamata { metodo: string; url: string; corpo: unknown }

function servizi(opz: { xmlErrori?: string[]; ficDown?: boolean; metadata?: Record<string, string>; eiStatus?: string } = {}) {
  const chiamate: Chiamata[] = [];
  let prossimoDoc = 500;
  const fetchFinto: typeof fetch = async (input, init) => {
    const url = String(input);
    const metodo = init?.method ?? "GET";
    const corpo = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
    chiamate.push({ metodo, url, corpo });
    const r = (j: unknown, status = 200) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });

    if (url.startsWith("https://api.stripe.com/v1/invoices/")) return r(fatturaStripe());
    if (url.startsWith("https://api.stripe.com/v1/customers/")) return r({ id: "cus_test_1", metadata: opz.metadata ?? {} });
    if (url.startsWith("https://api.stripe.com/v1/charges/")) {
      return r({ id: "ch_test_1", invoice: "in_test_1", refunds: { data: [{ id: "re_1", amount: 5000, status: "succeeded", created: 1793520000 }] } });
    }
    if (url.startsWith("https://api.resend.com/")) return r({ id: "email_1" });
    if (url === "https://pdf.esempio/doc.pdf") return new Response(new Uint8Array([37, 80, 68, 70]));

    if (url.includes("api-v2.fattureincloud.it")) {
      if (opz.ficDown) return r({ error: { message: "manutenzione" } }, 503);
      if (url.includes("/entities/clients?")) return r({ data: [] });
      if (url.endsWith("/entities/clients") && metodo === "POST") return r({ data: { id: 77 } });
      if (url.endsWith("/issued_documents") && metodo === "POST") return r({ data: { id: prossimoDoc++ } });
      if (url.includes("/e_invoice/xml_verify")) {
        return opz.xmlErrori ? r({ error: { message: "Errori XML", validation_result: { xml_errors: opz.xmlErrori } } }, 422) : r({ data: { success: true } });
      }
      if (url.includes("/e_invoice/send")) return r({ data: { name: "IT12345678903_00001.xml", date: "2026-11-01" } });
      if (url.includes("/e_invoice/error_reason")) return r({ data: { reason: "Codice destinatario inesistente", code: "00311", solution: "Verificare il codice destinatario", ei_status: "discarded" } });
      if (/\/issued_documents\/\d+\?fieldset=detailed/.test(url)) {
        const id = Number(url.match(/issued_documents\/(\d+)/)![1]);
        return r({ data: { id, number: 12, numeration: "", date: "2026-11-01", amount_net: 146.8, amount_vat: 32.3, amount_gross: 179.1, url: "https://pdf.esempio/doc.pdf", ei_status: opz.eiStatus ?? "not_sent" } });
      }
    }
    return r({ error: "non simulato" }, 404);
  };
  return { chiamate, fetchFinto };
}

function config(live: boolean): Config {
  return {
    stripeSecretKey: live ? "sk_live_x" : "sk_test_x", stripeWebhookSecret: "whsec", ficToken: "tok", ficCompanyId: "123",
    einvoiceLive: live, cronSecret: "c", ficWebhookToken: "t", functionsUrl: "https://f", pannelloUrl: "https://pannello",
    resendKey: "re_x", avvisiA: ["admin@nexora.it"], mittente: "fatture@nexora.it",
  };
}

function preparaJob(a: ArchivioMemoria, over: Partial<Job> = {}): Job {
  const job: Job = {
    id: "job_1", tipo: "fattura", stripe_invoice_id: "in_test_1", stripe_customer_id: "cus_test_1", stripe_charge_id: "ch_test_1",
    stripe_refund_id: null, importo_rimborso_cents: null, stato: "in_lavorazione", tentativi: 1, max_tentativi: 5,
    fic_document_id: null, invoice_id: null, ...over,
  };
  a.jobs.set(job.id, job);
  return job;
}

function dip(a: ArchivioMemoria, s: ReturnType<typeof servizi>, live = false): Dipendenze {
  const c = config(live);
  return {
    archivio: a, config: c, fetchFn: s.fetchFinto,
    stripe: new ClientStripe(c.stripeSecretKey, s.fetchFinto),
    fic: new ClientFic(c.ficToken, c.ficCompanyId, s.fetchFinto),
    postino: new Postino(c.resendKey, c.mittente, s.fetchFinto),
  };
}

const chiamateA = (s: ReturnType<typeof servizi>, parte: string) => s.chiamate.filter((c) => c.url.includes(parte));

// ---------- Test ----------

Deno.test("Fattura emessa in prova (EINVOICE_LIVE=false): niente invio reale allo SDI", async () => {
  const a = new ArchivioMemoria();
  a.profili.set("cus_test_1", { ...profilo });
  const s = servizi();
  const job = preparaJob(a);
  await elaboraJob(job, dip(a, s, false));

  assertEquals(a.jobs.get("job_1")!.stato, "emessa");
  assertEquals(a.jobs.get("job_1")!.fic_document_id, 500);
  // cliente creato su Fatture in Cloud con i dati del profilo
  const cliente = chiamateA(s, "/entities/clients").find((c) => c.metodo === "POST")!;
  // deno-lint-ignore no-explicit-any
  assertEquals((cliente.corpo as any).data.vat_number, "12345678903");
  // documento con data di incasso e righe esatte
  // deno-lint-ignore no-explicit-any
  const creato = chiamateA(s, "/issued_documents").find((c) => c.metodo === "POST" && c.url.endsWith("/issued_documents"))!.corpo as any;
  assertEquals(creato.data.type, "invoice");
  assertEquals(creato.data.e_invoice, true);
  assertEquals(creato.data.items_list.length, 3);
  // invio SOLO in dry run
  const invii = chiamateA(s, "/e_invoice/send");
  assertEquals(invii.length, 1);
  // deno-lint-ignore no-explicit-any
  assertEquals((invii[0]!.corpo as any).options.dry_run, true);
  // registrazione del documento
  assertEquals(a.documenti.length, 1);
  assertEquals(a.documenti[0]!.numero, "12");
  assertEquals(a.documenti[0]!.dry_run, true);
  assertEquals(a.documenti[0]!.stato_sdi, "not_sent");
  // email di cortesia: in prova all'amministratore, con il PDF allegato
  // deno-lint-ignore no-explicit-any
  const email = chiamateA(s, "api.resend.com")[0]!.corpo as any;
  assertEquals(email.to, ["admin@nexora.it"]);
  assert(email.subject.startsWith("[PROVA] Fattura n. 12"));
  assertEquals(email.attachments[0].content, "JVBERg==");
  // nei log niente P.IVA completa
  assertFalse(JSON.stringify(a.logs).includes("12345678903"));
});

Deno.test("EINVOICE_LIVE=true: invio reale e stato 'inviata'", async () => {
  const a = new ArchivioMemoria();
  a.profili.set("cus_test_1", { ...profilo });
  const s = servizi();
  await elaboraJob(preparaJob(a), dip(a, s, true));
  assertEquals(a.jobs.get("job_1")!.stato, "inviata");
  // deno-lint-ignore no-explicit-any
  assertEquals((chiamateA(s, "/e_invoice/send")[0]!.corpo as any).options.dry_run, false);
  assertEquals(a.documenti[0]!.stato_sdi, "sent");
  // deno-lint-ignore no-explicit-any
  assertEquals((chiamateA(s, "api.resend.com")[0]!.corpo as any).to, ["amministrazione@levante.it"]);
});

Deno.test("XML con errori: 'da_controllare', nessun invio, avviso con il dettaglio", async () => {
  const a = new ArchivioMemoria();
  a.profili.set("cus_test_1", { ...profilo });
  const s = servizi({ xmlErrori: ["Elemento CodiceDestinatario non valido"] });
  await elaboraJob(preparaJob(a), dip(a, s, true));
  assertEquals(a.jobs.get("job_1")!.stato, "da_controllare");
  assertEquals(chiamateA(s, "/e_invoice/send").length, 0);
  const avviso = a.avvisi.find((x) => x.tipo === "xml_non_valido")!;
  assert(avviso.testo.includes("CodiceDestinatario"));
});

Deno.test("Dati mancanti (anche nei metadata Stripe): 'dati_mancanti', nessuna chiamata a Fatture in Cloud", async () => {
  const a = new ArchivioMemoria();
  const s = servizi({ metadata: { ragione_sociale: "Cliente senza dati" } });
  await elaboraJob(preparaJob(a), dip(a, s, false));
  assertEquals(a.jobs.get("job_1")!.stato, "dati_mancanti");
  assertEquals(chiamateA(s, "fattureincloud").length, 0);
  const avviso = a.avvisi.find((x) => x.tipo === "dati_mancanti")!;
  assert(avviso.testo.includes("Partita IVA"));
  assert(a.profili.has("cus_test_1"), "profilo creato dai metadata del Customer Stripe");
});

Deno.test("Profilo letto dai metadata Stripe quando manca nel database", async () => {
  const a = new ArchivioMemoria();
  const meta = Object.fromEntries(Object.entries(profilo).filter(([k]) => k !== "stripe_customer_id").map(([k, v]) => [k, String(v ?? "")]));
  const s = servizi({ metadata: meta });
  await elaboraJob(preparaJob(a), dip(a, s, false));
  assertEquals(a.jobs.get("job_1")!.stato, "emessa");
});

Deno.test("Fatture in Cloud non disponibile: retry con backoff, poi 'errore' al 5° tentativo", async () => {
  const a = new ArchivioMemoria();
  a.profili.set("cus_test_1", { ...profilo });
  const s = servizi({ ficDown: true });
  await elaboraJob(preparaJob(a, { tentativi: 1 }), dip(a, s, false));
  assertEquals(a.jobs.get("job_1")!.stato, "in_coda");
  await elaboraJob(preparaJob(a, { tentativi: 5 }), dip(a, s, false));
  assertEquals(a.jobs.get("job_1")!.stato, "errore");
  assert(a.avvisi.some((x) => x.tipo === "errore_dopo_tentativi"));
});

Deno.test("Ripresa dopo un'interruzione: il documento già creato non viene duplicato", async () => {
  const a = new ArchivioMemoria();
  a.profili.set("cus_test_1", { ...profilo, fic_client_id: 77 });
  const s = servizi();
  await elaboraJob(preparaJob(a, { fic_document_id: 900 }), dip(a, s, false));
  assertEquals(chiamateA(s, "/issued_documents").filter((c) => c.metodo === "POST" && c.url.endsWith("/issued_documents")).length, 0);
  assertEquals(a.documenti[0]!.fic_document_id, 900);
  assertEquals(a.jobs.get("job_1")!.stato, "emessa");
});

Deno.test("Nota di credito parziale collegata alla fattura originale", async () => {
  const a = new ArchivioMemoria();
  a.profili.set("cus_test_1", { ...profilo });
  const s = servizi();
  await elaboraJob(preparaJob(a), dip(a, s, false));
  const nota = preparaJob(a, { id: "job_2", tipo: "nota_credito", stripe_refund_id: "re_1", importo_rimborso_cents: 5000 });
  await elaboraJob(nota, dip(a, s, false));
  assertEquals(a.jobs.get("job_2")!.stato, "emessa");
  // deno-lint-ignore no-explicit-any
  const doc = chiamateA(s, "/issued_documents").filter((c) => c.metodo === "POST" && c.url.endsWith("/issued_documents"))[1]!.corpo as any;
  assertEquals(doc.data.type, "credit_note");
  assertEquals(doc.data.items_list[0].gross_price, 50);
  assertEquals(doc.data.ei_data.invoice_number, "12");
  assertEquals(a.documenti[1]!.fattura_originale_id, a.documenti[0]!.id);
});

Deno.test("Nota di credito prima della fattura: si riprova più tardi", async () => {
  const a = new ArchivioMemoria();
  a.profili.set("cus_test_1", { ...profilo });
  const s = servizi();
  await elaboraJob(preparaJob(a, { id: "job_n", tipo: "nota_credito", stripe_refund_id: "re_1", importo_rimborso_cents: 5000 }), dip(a, s, false));
  assertEquals(a.jobs.get("job_n")!.stato, "in_coda");
});

Deno.test("Configurazione fiscale incompleta: 'da_controllare' e avviso", async () => {
  const a = new ArchivioMemoria();
  a.profili.set("cus_test_1", { ...profilo });
  a.conf = { ...impostazioniLordo, fic_payment_account_id: null };
  const s = servizi();
  await elaboraJob(preparaJob(a), dip(a, s, false));
  assertEquals(a.jobs.get("job_1")!.stato, "da_controllare");
  assert(a.avvisi.some((x) => x.tipo === "configurazione" && x.testo.includes("Conto di incasso")));
});

Deno.test("Esito SDI 'discarded': motivo letto e avviso con «Correggi e reinvia»", async () => {
  const a = new ArchivioMemoria();
  a.profili.set("cus_test_1", { ...profilo });
  await elaboraJob(preparaJob(a), dip(a, servizi(), true));
  const s = servizi({ eiStatus: "discarded" });
  await aggiornaEsitoSdi(500, dip(a, s, true));
  assertEquals(a.documenti[0]!.stato_sdi, "discarded");
  assertEquals(a.documenti[0]!.sdi_codice, "00311");
  assertEquals(a.jobs.get("job_1")!.stato, "scartata");
  const avviso = a.avvisi.find((x) => x.tipo === "scarto_sdi")!;
  assert(avviso.testo.includes("Codice destinatario inesistente"));
  assert(avviso.testo.includes("Correggi e reinvia"));
});
