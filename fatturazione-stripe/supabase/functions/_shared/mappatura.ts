/**
 * Fattura Stripe → documento emesso di Fatture in Cloud (issued_document).
 *
 * Regole:
 * - tutti i conti in CENTESIMI interi (come Stripe); si passa in euro solo nel payload finale;
 * - IVA, natura, dicitura, bollo, cassa, numerazione e metodi di pagamento arrivano da fiscal_settings:
 *   qui non c'è nessun valore fiscale fisso;
 * - il totale del documento deve coincidere al centesimo con il totale Stripe: se non coincide
 *   non si emette nulla (problema "importi non coerenti" → stato da_controllare).
 * Campi Fatture in Cloud verificati sull'SDK ufficiale 2.1.3 (IssuedDocument, IssuedDocumentItemsListItem,
 * IssuedDocumentPaymentsListItem, IssuedDocumentEiData, Entity).
 */

import type { ProfiloFatturazione } from "./validazione.ts";

// ---------- Tipi ----------

export interface RigaStripe {
  id: string;
  /** "subscription" (canone) o "invoiceitem" (voce una tantum) */
  tipo: string;
  /** importo della riga in centesimi, prima degli sconti */
  importo: number;
  descrizione: string | null;
  quantita: number | null;
  /** unix seconds; per gli abbonamenti la fine è esclusiva (inizio del periodo successivo) */
  periodo: { inizio: number; fine: number } | null;
  proration: boolean;
  prodotto: string | null;
  /** sconti applicati alla riga (coupon a livello di fattura ripartiti da Stripe) */
  sconti: { importo: number; discount: string }[];
  /** voce che rappresenta la marca da bollo addebitata (metadata bollo=true) */
  bollo: boolean;
}

export type MetodoIncasso = "carta" | "sepa" | "altro";

export interface FatturaStripe {
  id: string;
  numero: string | null;
  valuta: string;
  /** totale fattura in centesimi (dopo sconti e tasse) */
  totale: number;
  subtotale: number;
  /** tasse calcolate da Stripe (Stripe Tax), centesimi */
  tasse: number | null;
  importoPagato: number;
  cliente: string;
  righe: RigaStripe[];
  /** sconti totali per coupon/promozione */
  sconti: { importo: number; discount: string; nome: string }[];
  /** unix seconds del pagamento incassato */
  pagataIl: number | null;
  metodo: MetodoIncasso;
  chargeId: string | null;
}

export interface ImpostazioniFiscali {
  emittente_ragione_sociale: string | null;
  emittente_partita_iva: string | null;
  emittente_iban: string | null;
  regime_fiscale: string | null;
  aliquota_iva: number | null;
  natura_iva: string | null;
  fic_vat_id: number | null;
  dicitura: string | null;
  prezzi_stripe_ivati: boolean | null;
  bollo_applicato: boolean | null;
  bollo_importo: number | null;
  bollo_soglia: number | null;
  bollo_addebitato_cliente: boolean | null;
  cassa_tipo: string | null;
  cassa_aliquota: number | null;
  fic_numerazione: string | null;
  fic_numerazione_note_credito: string | null;
  fic_payment_account_id: number | null;
  codice_pagamento_carta: string | null;
  codice_pagamento_sepa: string | null;
  codice_pagamento_altro: string | null;
}

/** Rimborso Stripe da trasformare in nota di credito. */
export interface RimborsoStripe {
  id: string;
  /** centesimi rimborsati con QUESTO rimborso */
  importo: number;
  /** unix seconds */
  creatoIl: number;
}

export interface FatturaOriginale {
  numero: string;
  /** yyyy-mm-dd */
  data: string;
}

// ---------- Utilità ----------

const euro = (cent: number) => Math.round(cent) / 100;
const FUSO = "Europe/Rome";

/** yyyy-mm-dd nel fuso italiano */
export function dataIso(unix: number): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(unix * 1000));
  return p; // en-CA → 2026-11-01
}

/** gg/mm/aaaa nel fuso italiano */
export function dataIt(unix: number): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(unix * 1000));
}

const isoInIt = (iso: string) => iso.split("-").reverse().join("/");

/** IVA (o cassa) su un imponibile in centesimi, arrotondata al centesimo (metà per eccesso). */
export const percentuale = (baseCent: number, perc: number) => Math.round((baseCent * perc) / 100);

// ---------- Configurazione ----------

/** Elenco di ciò che manca nella configurazione fiscale per poter emettere. */
export function controllaConfigurazione(f: ImpostazioniFiscali | null, metodo?: MetodoIncasso): string[] {
  if (!f) return ["Configurazione fiscale assente"];
  const m: string[] = [];
  if (!f.emittente_ragione_sociale) m.push("Ragione sociale dell'emittente");
  if (!f.emittente_partita_iva) m.push("Partita IVA dell'emittente");
  if (!f.regime_fiscale) m.push("Regime fiscale");
  if (f.aliquota_iva == null && !f.natura_iva) m.push("Aliquota IVA oppure natura dell'operazione");
  if (f.natura_iva && !f.dicitura) m.push("Dicitura obbligatoria per l'operazione senza IVA");
  if (f.fic_vat_id == null) m.push("Tipo IVA di Fatture in Cloud");
  if (f.prezzi_stripe_ivati == null) m.push("Indicazione se i prezzi Stripe sono IVA inclusa");
  if (f.fic_payment_account_id == null) m.push("Conto di incasso su Fatture in Cloud");
  if (f.bollo_applicato == null) m.push("Impostazione marca da bollo");
  if (f.bollo_applicato && (f.bollo_importo == null || f.bollo_soglia == null || f.bollo_addebitato_cliente == null)) {
    m.push("Importo, soglia e addebito della marca da bollo");
  }
  if (f.cassa_tipo && f.cassa_aliquota == null) m.push("Aliquota della cassa previdenziale");
  if (metodo === "carta" && !f.codice_pagamento_carta) m.push("Codice modalità di pagamento per carta");
  if (metodo === "sepa" && !f.codice_pagamento_sepa) m.push("Codice modalità di pagamento per SEPA");
  if (metodo === "altro" && !f.codice_pagamento_altro) m.push("Codice modalità di pagamento per altri metodi");
  return m;
}

/**
 * Marca da bollo: solo se attiva in configurazione, per operazioni senza IVA (natura)
 * e con importo oltre la soglia configurata.
 */
export function calcolaBollo(f: ImpostazioniFiscali, baseCent: number): { applica: boolean; importoCent: number; addebitato: boolean } {
  const applica = !!f.bollo_applicato && !!f.natura_iva && f.bollo_soglia != null && f.bollo_importo != null &&
    baseCent > Math.round(f.bollo_soglia * 100);
  return { applica, importoCent: applica ? Math.round(f.bollo_importo! * 100) : 0, addebitato: applica && !!f.bollo_addebitato_cliente };
}

/** Totale documento atteso da un imponibile (prezzi netti) secondo la configurazione. */
function totaleDaImponibile(f: ImpostazioniFiscali, imponibile: number) {
  const cassa = f.cassa_tipo && f.cassa_aliquota ? percentuale(imponibile, f.cassa_aliquota) : 0;
  const iva = percentuale(imponibile + cassa, f.aliquota_iva ?? 0);
  return { cassa, iva, totale: imponibile + cassa + iva };
}

/** Scorporo esatto: l'imponibile che, con cassa e IVA, dà ESATTAMENTE il lordo (o null se non esiste). */
export function scorporo(f: ImpostazioniFiscali, lordoCent: number): number | null {
  const fattore = (1 + (f.cassa_tipo && f.cassa_aliquota ? f.cassa_aliquota / 100 : 0)) * (1 + (f.aliquota_iva ?? 0) / 100);
  const stima = Math.round(lordoCent / fattore);
  for (const d of [0, -1, 1, -2, 2]) {
    if (totaleDaImponibile(f, stima + d).totale === lordoCent) return stima + d;
  }
  return null;
}

// ---------- Anagrafica ----------

export function entityDaProfilo(p: ProfiloFatturazione, ficClientId?: number | null) {
  const italia = (p.nazione || "IT") === "IT";
  const codice = (p.codice_destinatario ?? "").toUpperCase();
  return {
    ...(ficClientId ? { id: ficClientId } : {}),
    type: p.tipo === "persona" ? "person" : p.tipo === "pa" ? "pa" : "company",
    name: p.ragione_sociale,
    vat_number: p.partita_iva,
    tax_code: p.codice_fiscale,
    address_street: p.via,
    address_postal_code: p.cap,
    address_city: p.comune,
    address_province: p.provincia,
    country_iso: p.nazione || "IT",
    ...(italia ? { country: "Italia" } : {}),
    email: p.email_amministrativa,
    certified_email: p.pec,
    e_invoice: true,
    // Estero: XXXXXXX; con sola PEC: 0000000
    ei_code: !italia ? "XXXXXXX" : codice && codice !== "0000000" ? codice : "0000000",
  };
}

// ---------- Righe ----------

function descrizioneRiga(r: RigaStripe): string {
  const prodotto = r.prodotto || r.descrizione || "servizio";
  if (r.periodo && r.periodo.fine > r.periodo.inizio && (r.tipo === "subscription" || r.proration)) {
    // La fine del periodo Stripe è esclusiva: l'ultimo giorno incluso è il giorno prima.
    const dal = dataIt(r.periodo.inizio);
    const al = dataIt(r.periodo.fine - 1);
    return r.proration ? `Adeguamento canone ${prodotto} dal ${dal} al ${al}` : `Canone abbonamento ${prodotto} dal ${dal} al ${al}`;
  }
  return r.descrizione || r.prodotto || "Servizio";
}

interface Voce {
  descrizione: string;
  qty: number;
  /** prezzo unitario in centesimi (lordo o netto a seconda della configurazione) */
  unitario: number;
}

/** Righe del documento a partire dalle righe Stripe: importi esatti, sconti come righe negative. */
export function vociDaFattura(fs: FatturaStripe, f: ImpostazioniFiscali): { voci: Voce[]; bolloStripe: number } {
  const voci: Voce[] = [];
  let bolloStripe = 0;
  for (const r of fs.righe) {
    if (r.bollo) {
      bolloStripe += r.importo;
      continue;
    }
    const q = r.quantita && r.quantita > 1 && r.importo % r.quantita === 0 ? r.quantita : 1;
    let descrizione = descrizioneRiga(r);
    if (r.quantita && r.quantita > 1 && q === 1) descrizione += ` (quantità ${r.quantita})`;
    voci.push({ descrizione, qty: q, unitario: r.importo / q });
  }
  for (const s of fs.sconti) {
    if (s.importo > 0) voci.push({ descrizione: `Sconto ${s.nome}`, qty: 1, unitario: -s.importo });
  }
  void f;
  return { voci, bolloStripe };
}

const sommaVoci = (voci: Voce[]) => voci.reduce((t, v) => t + v.unitario * v.qty, 0);

// ---------- Documento ----------

export interface EsitoMappatura {
  /** payload "data" per POST /c/{company_id}/issued_documents */
  documento: Record<string, unknown> | null;
  /** totale atteso in centesimi (deve coincidere con Stripe) */
  totaleCent: number;
  imponibileCent: number;
  ivaCent: number;
  problemi: string[];
}

interface Parametri {
  fattura: FatturaStripe;
  impostazioni: ImpostazioniFiscali;
  profilo: ProfiloFatturazione;
  ficClientId?: number | null;
  /** solo per le note di credito */
  rimborso?: RimborsoStripe;
  originale?: FatturaOriginale;
}

export function codicePagamento(f: ImpostazioniFiscali, m: MetodoIncasso): string | null {
  return m === "carta" ? f.codice_pagamento_carta : m === "sepa" ? f.codice_pagamento_sepa : f.codice_pagamento_altro;
}

export function costruisciDocumento(p: Parametri): EsitoMappatura {
  const { fattura: fs, impostazioni: f } = p;
  const problemi: string[] = [];
  const nota = !!p.rimborso;

  if (fs.valuta.toLowerCase() !== "eur") problemi.push(`Valuta ${fs.valuta.toUpperCase()} non gestita: la fattura elettronica è in euro`);
  if (!nota && !fs.pagataIl) problemi.push("La fattura Stripe non risulta pagata");
  if (fs.tasse && fs.tasse > 0 && f.prezzi_stripe_ivati) {
    problemi.push("Stripe ha aggiunto le tasse a parte ma la configurazione dice prezzi IVA inclusa: controlla l'impostazione");
  }
  const mancaConfig = controllaConfigurazione(f, fs.metodo);
  if (mancaConfig.length) problemi.push(`Configurazione fiscale incompleta: ${mancaConfig.join(", ")}`);

  let voci: Voce[];
  let bolloStripe = 0;
  if (!nota) {
    ({ voci, bolloStripe } = vociDaFattura(fs, f));
    // Coerenza: gli sconti di riga devono corrispondere agli sconti totali
    const scontiRighe = fs.righe.reduce((t, r) => t + r.sconti.reduce((a, s) => a + s.importo, 0), 0);
    const scontiTot = fs.sconti.reduce((t, s) => t + s.importo, 0);
    if (scontiRighe !== scontiTot) problemi.push(`Sconti Stripe non coerenti (righe ${scontiRighe} ≠ totale ${scontiTot} centesimi)`);
  } else {
    const r = p.rimborso!;
    const intero = r.importo === fs.totale;
    if (intero) {
      ({ voci, bolloStripe } = vociDaFattura(fs, f));
    } else {
      const rif = p.originale ? ` fattura n. ${p.originale.numero} del ${isoInIt(p.originale.data)}` : "";
      voci = [{ descrizione: `Rimborso parziale relativo alla${rif}`, qty: 1, unitario: r.importo }];
    }
  }

  // Importi: prezzi lordi (IVA inclusa) o netti secondo la configurazione
  const lordi = !!f.prezzi_stripe_ivati;
  let imponibileCent: number;
  let ivaCent: number;
  let totaleCent: number;
  const atteso = nota ? p.rimborso!.importo : fs.totale;

  if (lordi) {
    totaleCent = sommaVoci(voci) + bolloStripe;
    const lordoServizi = sommaVoci(voci);
    const imp = scorporo(f, lordoServizi);
    imponibileCent = imp ?? Math.round(lordoServizi / (1 + (f.aliquota_iva ?? 0) / 100));
    ivaCent = lordoServizi - imponibileCent - (f.cassa_tipo && f.cassa_aliquota ? percentuale(imponibileCent, f.cassa_aliquota) : 0);
  } else if (nota && p.rimborso!.importo !== fs.totale) {
    // Rimborso parziale con prezzi netti: si ricava l'imponibile esatto dal lordo rimborsato
    const imp = scorporo(f, p.rimborso!.importo);
    if (imp == null) {
      problemi.push("Il rimborso parziale non si scompone esattamente in imponibile e IVA: serve una nota di credito manuale");
      voci = [];
      imponibileCent = 0;
    } else {
      voci = [{ ...voci[0]!, unitario: imp }];
      imponibileCent = imp;
    }
    const t = totaleDaImponibile(f, imponibileCent);
    ivaCent = t.iva;
    totaleCent = t.totale;
  } else {
    imponibileCent = sommaVoci(voci);
    const t = totaleDaImponibile(f, imponibileCent);
    ivaCent = t.iva;
    totaleCent = t.totale + bolloStripe;
  }

  const bollo = calcolaBollo(f, imponibileCent);
  if (bollo.addebitato && bolloStripe !== bollo.importoCent) {
    problemi.push(`Marca da bollo da addebitare (${bollo.importoCent} centesimi) non presente come voce Stripe con metadata bollo=true`);
  }
  if (!bollo.addebitato && bolloStripe > 0) {
    problemi.push("Su Stripe c'è una voce di bollo ma la configurazione non prevede l'addebito al cliente");
  }

  if (totaleCent !== atteso) {
    problemi.push(`Importi non coerenti: totale documento ${euro(totaleCent).toFixed(2)} € ≠ ${nota ? "rimborso" : "incasso"} Stripe ${euro(atteso).toFixed(2)} €`);
  }

  if (problemi.length) return { documento: null, totaleCent, imponibileCent, ivaCent, problemi };

  const data = dataIso(nota ? p.rimborso!.creatoIl : fs.pagataIl!);
  const codice = codicePagamento(f, fs.metodo)!;
  const items_list = voci.map((v) => ({
    name: v.descrizione.slice(0, 200),
    description: v.descrizione.length > 200 ? v.descrizione : undefined,
    qty: v.qty,
    ...(lordi ? { gross_price: euro(v.unitario) } : { net_price: euro(v.unitario) }),
    vat: { id: f.fic_vat_id },
  }));

  const documento: Record<string, unknown> = {
    type: nota ? "credit_note" : "invoice",
    entity: entityDaProfilo(p.profilo, p.ficClientId),
    date: data,
    ...((nota ? f.fic_numerazione_note_credito : f.fic_numerazione) ? { numeration: nota ? f.fic_numerazione_note_credito : f.fic_numerazione } : {}),
    e_invoice: true,
    use_gross_prices: lordi,
    items_list,
    payments_list: [{
      amount: euro(totaleCent),
      due_date: data,
      paid_date: data,
      status: "paid",
      payment_account: { id: f.fic_payment_account_id },
    }],
    ei_data: {
      payment_method: codice,
      ...(codice === "MP05" && f.emittente_iban ? { bank_iban: f.emittente_iban } : {}),
      // DA VERIFICARE: che invoice_number/invoice_date producano il blocco DatiFattureCollegate nell'XML
      ...(nota && p.originale ? { invoice_number: p.originale.numero, invoice_date: p.originale.data } : {}),
    },
    ...(f.dicitura ? { notes: f.dicitura } : {}),
    ...(f.cassa_tipo && f.cassa_aliquota ? { cassa: f.cassa_aliquota, ei_cassa_type: f.cassa_tipo } : {}),
    ...(bollo.applica ? { stamp_duty: euro(bollo.importoCent) } : {}),
    visible_subject: nota ? `Nota di credito – rimborso Stripe` : fs.numero ? `Pagamento ${fs.numero}` : undefined,
  };
  return { documento, totaleCent, imponibileCent, ivaCent, problemi };
}
