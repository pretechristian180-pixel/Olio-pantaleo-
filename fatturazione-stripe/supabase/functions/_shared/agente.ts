/**
 * Agente di fatturazione: elabora i job della coda (punto 4 a-g), gli esiti SDI, i controlli e il riepilogo.
 * Ogni passo è ripetibile: se l'agente si interrompe dopo aver creato il documento su Fatture in Cloud,
 * al tentativo successivo riprende quel documento (fic_document_id salvato nel job) invece di crearne un altro.
 */
import type { Archivio, Documento, Job } from "./archivio.ts";
import type { Config } from "./config.ts";
import { base64DaBuffer, escapeHtml, euroIt, impagina, type Postino } from "./email.ts";
import { ClientFic, ESITI_DEFINITIVI, spiegaStatoSdi, statoJobDaSdi } from "./fic.ts";
import { controllaConfigurazione, costruisciDocumento, dataIt, entityDaProfilo, type FatturaStripe } from "./mappatura.ts";
import { mascheraCodice } from "./maschera.ts";
import { ClientStripe, ErroreDefinitivo, ErroreTemporaneo, normalizzaFattura } from "./stripe.ts";
import { controllaProfilo, normalizzaProfilo, profiloDaMetadata, type ProfiloFatturazione } from "./validazione.ts";

export interface Dipendenze {
  archivio: Archivio;
  stripe: ClientStripe;
  fic: ClientFic;
  postino: Postino;
  config: Config;
  /** per scaricare il PDF da allegare (iniettabile nei test) */
  fetchFn?: typeof fetch;
}

/** Fine del job con un esito che richiede l'intervento dell'amministratore (niente retry). */
class Fermo extends Error {
  constructor(public stato: "dati_mancanti" | "da_controllare", messaggio: string, public dettaglio?: unknown) {
    super(messaggio);
  }
}

const linkPannello = (c: Config, percorso: string) => (c.pannelloUrl ? `${c.pannelloUrl.replace(/\/$/, "")}${percorso}` : "");

// ---------------------------------------------------------------------------
// Coda
// ---------------------------------------------------------------------------

export async function elaboraCoda(d: Dipendenze, limite = 10): Promise<{ elaborati: number }> {
  const jobs = await d.archivio.prendiJob(limite);
  for (const job of jobs) await elaboraJob(job, d);
  await inviaAvvisiPendenti(d);
  return { elaborati: jobs.length };
}

export async function elaboraJob(job: Job, d: Dipendenze): Promise<void> {
  const rif = job.stripe_refund_id ?? job.stripe_invoice_id;
  try {
    await d.archivio.log("info", `${job.tipo}:inizio`, rif, `Tentativo ${job.tentativi} di ${job.max_tentativi}`);
    if (job.tipo === "fattura") await emettiFattura(job, d);
    else await emettiNotaCredito(job, d);
  } catch (e) {
    if (e instanceof Fermo) {
      await d.archivio.aggiornaJob(job.id, { stato: e.stato, ultimo_errore: e.message, dettaglio: e.dettaglio ?? null });
      await d.archivio.log("avviso", `${job.tipo}:fermo`, rif, e.message);
      return;
    }
    const messaggio = e instanceof Error ? e.message : "errore sconosciuto";
    if (e instanceof ErroreDefinitivo) {
      // Rifiuto esplicito (dati non accettati da Fatture in Cloud o Stripe): ripetere non serve
      await d.archivio.aggiornaJob(job.id, { stato: "da_controllare", ultimo_errore: messaggio });
      await d.archivio.avviso({
        tipo: "configurazione",
        titolo: `${job.tipo === "fattura" ? "Fattura" : "Nota di credito"} da controllare`,
        testo: `Pagamento ${job.stripe_invoice_id}: ${messaggio}`,
        job_id: job.id,
      });
      await d.archivio.log("errore", `${job.tipo}:rifiutato`, rif, messaggio);
      return;
    }
    // Temporaneo o imprevisto: retry con backoff (dopo il 5° tentativo → "errore" + avviso, lato database)
    const stato = await d.archivio.riprova(job.id, messaggio);
    await d.archivio.log(stato === "errore" ? "errore" : "avviso", `${job.tipo}:riprova`, rif,
      stato === "errore" ? `Errore dopo ${job.tentativi} tentativi: ${messaggio}` : `Errore temporaneo, nuovo tentativo: ${messaggio}`,
      { temporaneo: e instanceof ErroreTemporaneo });
  }
}

// ---------------------------------------------------------------------------
// Passi comuni
// ---------------------------------------------------------------------------

/** b) Dati di fatturazione: dal database, altrimenti dai metadata del Customer Stripe. */
async function datiCliente(customerId: string, job: Job, d: Dipendenze): Promise<ProfiloFatturazione & { fic_client_id?: number | null }> {
  let profilo = await d.archivio.profilo(customerId);
  if (!profilo) {
    const customer = await d.stripe.customer(customerId);
    profilo = profiloDaMetadata(customerId, customer.metadata ?? {});
    await d.archivio.salvaProfilo(profilo);
    await d.archivio.log("info", "profilo:da_stripe", customerId, "Dati di fatturazione letti dai metadata del Customer Stripe");
  }
  const p = normalizzaProfilo(profilo);
  const esito = controllaProfilo(p);
  if (!esito.ok) {
    const elenco = [...esito.mancanti.map((m) => `manca ${m}`), ...esito.errori].join("; ");
    await d.archivio.avviso({
      tipo: "dati_mancanti",
      titolo: "Dati di fatturazione incompleti",
      testo: `Cliente ${p.ragione_sociale ?? customerId} (${customerId}): ${elenco}. La fattura partirà appena li completi e premi «Riprova».`,
      job_id: job.id,
    });
    throw new Fermo("dati_mancanti", `Dati di fatturazione incompleti: ${elenco}`, esito);
  }
  return { ...p, fic_client_id: profilo.fic_client_id ?? null };
}

const CAMPI_CONFRONTO = ["name", "vat_number", "tax_code", "address_street", "address_postal_code", "address_city", "address_province", "email", "certified_email", "ei_code"] as const;

/** b) Cliente su Fatture in Cloud: cerca per P.IVA, crea se manca, aggiorna se i dati sono cambiati. */
async function clienteFic(p: ProfiloFatturazione & { fic_client_id?: number | null }, d: Dipendenze): Promise<number> {
  const entity = entityDaProfilo(p);
  const esistente = await d.fic.cercaCliente(p.partita_iva, p.codice_fiscale);
  if (!esistente) {
    const nuovo = await d.fic.creaCliente(entity);
    await d.archivio.impostaFicCliente(p.stripe_customer_id, nuovo.id);
    await d.archivio.log("info", "fic:cliente_creato", p.stripe_customer_id, "Cliente creato su Fatture in Cloud", { fic_id: nuovo.id, partita_iva: mascheraCodice(p.partita_iva) });
    return nuovo.id;
  }
  const cambiati = CAMPI_CONFRONTO.filter((k) => (esistente[k] ?? null) !== ((entity as Record<string, unknown>)[k] ?? null));
  if (cambiati.length) {
    await d.fic.aggiornaCliente(esistente.id, entity);
    await d.archivio.log("info", "fic:cliente_aggiornato", p.stripe_customer_id, `Dati aggiornati: ${cambiati.join(", ")}`);
  }
  if (p.fic_client_id !== esistente.id) await d.archivio.impostaFicCliente(p.stripe_customer_id, esistente.id);
  return esistente.id;
}

/** c-f) Crea (o riprende) il documento, verifica l'XML, invia allo SDI e registra tutto. */
async function documentoEInvio(
  job: Job,
  d: Dipendenze,
  dati: { documento: Record<string, unknown>; tipo: "fattura" | "nota_credito"; fs: FatturaStripe; customerId: string; fatturaOriginaleId?: string | null },
): Promise<Documento> {
  const rif = job.stripe_refund_id ?? job.stripe_invoice_id;
  let ficId = job.fic_document_id;
  if (!ficId) {
    const creato = await d.fic.creaDocumento(dati.documento);
    ficId = creato.id as number;
    // Salvato subito: un nuovo tentativo non crea un secondo documento
    await d.archivio.aggiornaJob(job.id, { fic_document_id: ficId, stato: "emessa" });
    await d.archivio.log("info", `${dati.tipo}:creato`, rif, "Documento creato su Fatture in Cloud", { fic_document_id: ficId });
  }

  const doc = await d.fic.leggiDocumento(ficId);
  let registrato = await d.archivio.documentoPerFic(ficId);
  if (!registrato) {
    registrato = await d.archivio.salvaDocumento({
      tipo: dati.tipo,
      stripe_invoice_id: job.stripe_invoice_id,
      stripe_customer_id: dati.customerId,
      stripe_refund_id: job.stripe_refund_id,
      fattura_originale_id: dati.fatturaOriginaleId ?? null,
      fic_document_id: ficId,
      numero: doc.number != null ? `${doc.number}${doc.numeration ?? ""}` : null,
      data: doc.date ?? null,
      imponibile: doc.amount_net ?? null,
      iva: doc.amount_vat ?? null,
      totale: doc.amount_gross ?? null,
      stato_sdi: doc.ei_status ?? "not_sent",
      sdi_motivo: null,
      sdi_soluzione: null,
      sdi_codice: null,
      pdf_url: doc.url ?? null,
      dry_run: !d.config.einvoiceLive,
      inviata_at: null,
      esito_at: null,
      email_cliente_at: null,
    });
    await d.archivio.aggiornaJob(job.id, { invoice_id: registrato.id });
  }

  // d) Verifica XML: con errori NON si invia
  const verifica = await d.fic.verificaXml(ficId);
  if (!verifica.ok) {
    await d.archivio.avviso({
      tipo: "xml_non_valido",
      titolo: `XML non valido: ${dati.tipo === "fattura" ? "fattura" : "nota di credito"} ${registrato.numero ?? ""} non inviata`,
      testo: `Errori segnalati da Fatture in Cloud:\n- ${verifica.errori.join("\n- ")}`,
      job_id: job.id,
      invoice_id: registrato.id,
    });
    throw new Fermo("da_controllare", "XML non valido: documento non inviato", { errori_xml: verifica.errori });
  }

  // e) Invio allo SDI (prova se EINVOICE_LIVE non è "true")
  if (!registrato.inviata_at || registrato.stato_sdi === "not_sent") {
    const dryRun = !d.config.einvoiceLive;
    await d.fic.inviaSdi(ficId, dryRun);
    const adesso = new Date().toISOString();
    await d.archivio.aggiornaDocumento(registrato.id, dryRun ? { stato_sdi: "not_sent", dry_run: true } : { stato_sdi: "sent", inviata_at: adesso, dry_run: false });
    await d.archivio.aggiornaJob(job.id, { stato: dryRun ? "emessa" : "inviata", ultimo_errore: null });
    await d.archivio.log("info", `${dati.tipo}:${dryRun ? "prova_invio" : "inviata_sdi"}`, rif,
      dryRun ? "Prova di invio (dry run): nulla è stato inviato allo SDI" : "Inviata allo SDI", { fic_document_id: ficId });
    registrato = { ...registrato, ...(dryRun ? { stato_sdi: "not_sent", dry_run: true } : { stato_sdi: "sent", inviata_at: adesso, dry_run: false }) };
  }
  return registrato;
}

/** g) Email di cortesia con PDF e riepilogo pagamento. In prova va all'amministratore, non al cliente. */
async function emailCortesia(doc: Documento, p: ProfiloFatturazione, fs: FatturaStripe, d: Dipendenze, importoCent: number) {
  if (doc.email_cliente_at || !d.postino.attivo) return;
  const prova = !d.config.einvoiceLive;
  const destinatari = prova ? d.config.avvisiA : p.email_amministrativa ? [p.email_amministrativa] : [];
  if (!destinatari.length) return;
  const fresco = await d.fic.leggiDocumento(doc.fic_document_id).catch(() => null);
  const pdfUrl = fresco?.url ?? doc.pdf_url;
  let allegati: { filename: string; content: string }[] = [];
  if (pdfUrl) {
    const res = await (d.fetchFn ?? fetch)(pdfUrl).catch(() => null);
    if (res?.ok) allegati = [{ filename: `${doc.tipo === "fattura" ? "Fattura" : "Nota-di-credito"}-${(doc.numero ?? "").replace(/[^\w-]/g, "")}.pdf`, content: base64DaBuffer(await res.arrayBuffer()) }];
  }
  const nota = doc.tipo === "nota_credito";
  const metodo = fs.metodo === "carta" ? "carta di pagamento" : fs.metodo === "sepa" ? "addebito SEPA" : "pagamento elettronico";
  const corpo = `<p>Gentile ${escapeHtml(p.ragione_sociale ?? "cliente")},</p>
<p>${nota ? "in allegato trova la nota di credito relativa al rimborso" : "grazie per il pagamento. In allegato trova la copia di cortesia della fattura"} n. <strong>${escapeHtml(doc.numero ?? "")}</strong> del ${doc.data ? escapeHtml(doc.data.split("-").reverse().join("/")) : ""}.</p>
<table cellpadding="6" style="border-collapse:collapse;font-size:14px">
<tr><td style="color:#5b6578">Importo</td><td><strong>${euroIt(importoCent / 100)}</strong></td></tr>
<tr><td style="color:#5b6578">${nota ? "Rimborso" : "Pagato con"}</td><td>${escapeHtml(metodo)}</td></tr>
${fs.pagataIl && !nota ? `<tr><td style="color:#5b6578">Data incasso</td><td>${dataIt(fs.pagataIl)}</td></tr>` : ""}
</table>
<p style="color:#5b6578;font-size:13px">L'originale del documento è quello trasmesso tramite il Sistema di Interscambio ed è disponibile nel suo cassetto fiscale.</p>`;
  const inviata = await d.postino.invia({
    a: destinatari,
    oggetto: `${prova ? "[PROVA] " : ""}${nota ? "Nota di credito" : "Fattura"} n. ${doc.numero ?? ""}`,
    html: impagina(nota ? "Nota di credito" : "La tua fattura", corpo),
    allegati,
  });
  if (inviata) {
    await d.archivio.aggiornaDocumento(doc.id, { email_cliente_at: new Date().toISOString() });
    await d.archivio.log("info", "email:cortesia", doc.stripe_invoice_id, prova ? "Copia di cortesia inviata all'amministratore (prova)" : "Copia di cortesia inviata al cliente");
  }
}

// ---------------------------------------------------------------------------
// Fattura e nota di credito
// ---------------------------------------------------------------------------

async function emettiFattura(job: Job, d: Dipendenze) {
  // a) Fattura pagata da Stripe con righe, sconti, periodo, data e metodo di incasso
  const raw = await d.stripe.fattura(job.stripe_invoice_id);
  if (raw.status !== "paid") throw new Fermo("da_controllare", `La fattura Stripe è in stato "${raw.status}": si emette solo a pagamento incassato`);
  const fs = normalizzaFattura(raw);
  if (fs.totale <= 0) throw new Fermo("da_controllare", "Fattura Stripe a importo zero: nessun documento fiscale emesso in automatico");

  const impostazioni = await d.archivio.impostazioni();
  const mancanti = controllaConfigurazione(impostazioni, fs.metodo);
  if (mancanti.length) {
    await d.archivio.avviso({ tipo: "configurazione", titolo: "Configurazione fiscale incompleta", testo: `Da completare nel pannello: ${mancanti.join(", ")}.`, job_id: job.id });
    throw new Fermo("da_controllare", `Configurazione fiscale incompleta: ${mancanti.join(", ")}`);
  }

  const profilo = await datiCliente(fs.cliente, job, d);
  const ficClientId = await clienteFic(profilo, d);

  const m = costruisciDocumento({ fattura: fs, impostazioni: impostazioni!, profilo, ficClientId });
  if (!m.documento) {
    await d.archivio.avviso({ tipo: "importi_non_coerenti", titolo: "Fattura non emessa: da controllare", testo: `Pagamento ${fs.id}: ${m.problemi.join("; ")}`, job_id: job.id });
    throw new Fermo("da_controllare", m.problemi.join("; "), { problemi: m.problemi });
  }
  await d.archivio.log("info", "fattura:mappata", fs.id, "Documento preparato", {
    righe: (m.documento.items_list as unknown[]).length, totale_cent: m.totaleCent, metodo: fs.metodo, partita_iva: mascheraCodice(profilo.partita_iva),
  });

  const doc = await documentoEInvio(job, d, { documento: m.documento, tipo: "fattura", fs, customerId: fs.cliente });
  await emailCortesia(doc, profilo, fs, d, m.totaleCent);
}

async function emettiNotaCredito(job: Job, d: Dipendenze) {
  // La nota di credito si collega alla fattura originale: se non è ancora emessa si riprova più tardi
  const originale = await d.archivio.fatturaDi(job.stripe_invoice_id);
  if (!originale || !originale.numero) throw new ErroreTemporaneo("La fattura originale non è ancora stata emessa");

  const raw = await d.stripe.fattura(job.stripe_invoice_id);
  const fs = normalizzaFattura(raw);
  const charge = job.stripe_charge_id ? await d.stripe.charge(job.stripe_charge_id) : null;
  // deno-lint-ignore no-explicit-any
  const refund = charge?.refunds?.data?.find((r: any) => r.id === job.stripe_refund_id);
  const importo = job.importo_rimborso_cents ?? refund?.amount;
  if (!importo) throw new Fermo("da_controllare", "Importo del rimborso non disponibile");
  if (importo > fs.totale) throw new Fermo("da_controllare", "Il rimborso supera l'importo della fattura");

  const impostazioni = await d.archivio.impostazioni();
  const mancanti = controllaConfigurazione(impostazioni, fs.metodo);
  if (mancanti.length) throw new Fermo("da_controllare", `Configurazione fiscale incompleta: ${mancanti.join(", ")}`);

  const profilo = await datiCliente(fs.cliente, job, d);
  const ficClientId = await clienteFic(profilo, d);
  const m = costruisciDocumento({
    fattura: fs,
    impostazioni: impostazioni!,
    profilo,
    ficClientId,
    rimborso: { id: job.stripe_refund_id!, importo, creatoIl: refund?.created ?? Math.floor(Date.now() / 1000) },
    originale: { numero: originale.numero, data: originale.data! },
  });
  if (!m.documento) {
    await d.archivio.avviso({ tipo: "importi_non_coerenti", titolo: "Nota di credito non emessa: da controllare", testo: `Rimborso ${job.stripe_refund_id}: ${m.problemi.join("; ")}`, job_id: job.id });
    throw new Fermo("da_controllare", m.problemi.join("; "), { problemi: m.problemi });
  }
  const doc = await documentoEInvio(job, d, { documento: m.documento, tipo: "nota_credito", fs, customerId: fs.cliente, fatturaOriginaleId: originale.id });
  await emailCortesia(doc, profilo, fs, d, importo);
}

// ---------------------------------------------------------------------------
// Esiti SDI, controlli, avvisi, riepilogo
// ---------------------------------------------------------------------------

/** Legge lo stato SDI aggiornato del documento e lo registra; per scarti legge il motivo e avvisa. */
export async function aggiornaEsitoSdi(ficId: number, d: Dipendenze): Promise<string | null> {
  const registrato = await d.archivio.documentoPerFic(ficId);
  if (!registrato) return null;
  const doc = await d.fic.leggiDocumento(ficId);
  const ei: string | null = doc.ei_status ?? null;
  if (!ei || ei === registrato.stato_sdi) return ei;
  const statoJob = statoJobDaSdi(ei);
  const patch: Partial<Documento> = { stato_sdi: ei };
  if (ESITI_DEFINITIVI.includes(ei)) patch.esito_at = new Date().toISOString();

  if (statoJob === "scartata") {
    const motivo = await d.fic.motivoScarto(ficId).catch(() => null);
    patch.sdi_motivo = motivo?.reason ?? null;
    patch.sdi_soluzione = motivo?.solution ?? null;
    patch.sdi_codice = motivo?.code ?? null;
    await d.archivio.avviso({
      tipo: "scarto_sdi",
      titolo: `${registrato.tipo === "fattura" ? "Fattura" : "Nota di credito"} ${registrato.numero ?? ""}: ${spiegaStatoSdi(ei)}`,
      testo: [
        motivo?.code ? `Codice ${motivo.code}.` : "",
        motivo?.reason ? `Motivo: ${motivo.reason}` : "Motivo non disponibile.",
        motivo?.solution ? `Come risolvere: ${motivo.solution}` : "",
        "Correggi i dati nel pannello e usa «Correggi e reinvia».",
      ].filter(Boolean).join("\n"),
      invoice_id: registrato.id,
    });
  }
  await d.archivio.aggiornaDocumento(registrato.id, patch);
  if (statoJob) await d.archivio.aggiornaJobPerFic(ficId, { stato: statoJob });
  await d.archivio.log(statoJob === "scartata" ? "avviso" : "info", "sdi:esito", registrato.stripe_invoice_id, spiegaStatoSdi(ei), { fic_document_id: ficId, ei_status: ei });
  return ei;
}

/** Controllo giornaliero: inviate da più di 5 giorni senza esito definitivo → segnalazione. */
export async function controlloEsiti(d: Dipendenze, giorni = 5): Promise<number> {
  let segnalate = 0;
  for (const doc of await d.archivio.documentiSenzaEsito(giorni)) {
    const ei = await aggiornaEsitoSdi(doc.fic_document_id, d).catch(() => doc.stato_sdi);
    if (ei && ESITI_DEFINITIVI.includes(ei)) continue;
    if (await d.archivio.esisteAvviso("esito_in_ritardo", doc.id)) continue;
    await d.archivio.avviso({
      tipo: "esito_in_ritardo",
      titolo: `Nessun esito SDI dopo ${giorni} giorni: ${doc.numero ?? doc.fic_document_id}`,
      testo: `Inviata il ${doc.inviata_at?.slice(0, 10).split("-").reverse().join("/")}, stato attuale: ${spiegaStatoSdi(ei)}. Controlla su Fatture in Cloud.`,
      invoice_id: doc.id,
    });
    segnalate++;
  }
  await inviaAvvisiPendenti(d);
  return segnalate;
}

/** Avvisi immediati via email all'amministratore. */
export async function inviaAvvisiPendenti(d: Dipendenze): Promise<number> {
  if (!d.postino.attivo || !d.config.avvisiA.length) return 0;
  let n = 0;
  for (const a of await d.archivio.avvisiDaInviare()) {
    const link = a.tipo === "scarto_sdi" ? linkPannello(d.config, `/?documento=${a.invoice_id}`) : linkPannello(d.config, `/?job=${a.job_id ?? ""}`);
    const ok = await d.postino.invia({
      a: d.config.avvisiA,
      oggetto: `Fatturazione: ${a.titolo}`,
      html: impagina(a.titolo, `<p style="white-space:pre-line">${escapeHtml(a.testo)}</p>`,
        link ? { testo: a.tipo === "scarto_sdi" ? "Correggi e reinvia" : "Apri il pannello", url: link } : undefined),
    });
    if (ok) {
      await d.archivio.segnaAvvisoInviato(a.id);
      n++;
    }
  }
  return n;
}

/** Riepilogo del lunedì. */
export async function riepilogoSettimanale(d: Dipendenze): Promise<boolean> {
  const r = await d.archivio.riepilogo();
  const righe = [
    ["Incassato (fatture emesse)", euroIt(Number(r.incassato))],
    ["Fatture emesse", String(r.fatture)],
    ["Note di credito", String(r.note_credito)],
    ["Scarti SDI", String(r.scarti)],
    ["Job da gestire (errori, dati mancanti, da controllare)", String(r.job_da_gestire)],
  ].map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#5b6578">${k}</td><td style="padding:6px 0"><strong>${v}</strong></td></tr>`).join("");
  const prova = d.config.einvoiceLive ? "" : `<p style="color:#b45309">Modalità prova attiva: nessuna fattura è stata inviata allo SDI.</p>`;
  return await d.postino.invia({
    a: d.config.avvisiA,
    oggetto: "Fatturazione: riepilogo della settimana",
    html: impagina("Riepilogo della settimana", `${prova}<table>${righe}</table>`, d.config.pannelloUrl ? { testo: "Apri il pannello", url: d.config.pannelloUrl } : undefined),
  });
}
