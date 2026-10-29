/**
 * Validazione formale dei dati di fatturazione.
 * Controlla FORMA e cifre di controllo: non verifica che una P.IVA esista o sia attiva.
 */

export type TipoSoggetto = "azienda" | "persona" | "pa";

export interface ProfiloFatturazione {
  stripe_customer_id: string;
  tipo: TipoSoggetto;
  ragione_sociale: string | null;
  partita_iva: string | null;
  codice_fiscale: string | null;
  via: string | null;
  cap: string | null;
  comune: string | null;
  provincia: string | null;
  nazione: string;
  codice_destinatario: string | null;
  pec: string | null;
  email_amministrativa: string | null;
  fic_client_id?: number | null;
}

/** P.IVA italiana: 11 cifre con cifra di controllo (algoritmo dell'Agenzia delle Entrate). */
export function partitaIvaValida(valore: string): boolean {
  const p = valore.replace(/^IT/i, "").trim();
  if (!/^\d{11}$/.test(p) || /^0{11}$/.test(p)) return false;
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let c = Number(p[i]);
    if (i % 2 === 1) {
      c *= 2;
      if (c > 9) c -= 9;
    }
    somma += c;
  }
  return (10 - (somma % 10)) % 10 === Number(p[10]);
}

const DISPARI: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const valorePari = (c: string) => (/\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65);

/**
 * Codice fiscale: 16 caratteri (persone fisiche, anche in omocodia) con carattere di controllo,
 * oppure 11 cifre (società ed enti, stesso algoritmo della P.IVA).
 */
export function codiceFiscaleValido(valore: string): boolean {
  const cf = valore.toUpperCase().trim();
  if (/^\d{11}$/.test(cf)) return partitaIvaValida(cf);
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false;
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    // posizioni 1, 3, 5… (indice pari) = "dispari" nella regola ufficiale
    somma += i % 2 === 0 ? DISPARI[cf[i]!]! : valorePari(cf[i]!);
  }
  return String.fromCharCode(65 + (somma % 26)) === cf[15];
}

/** Codice destinatario SDI: 7 caratteri alfanumerici (6 per la Pubblica Amministrazione). */
export function codiceDestinatarioValido(valore: string, tipo: TipoSoggetto): boolean {
  const c = valore.toUpperCase().trim();
  return tipo === "pa" ? /^[A-Z0-9]{6}$/.test(c) : /^[A-Z0-9]{7}$/.test(c);
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface EsitoControllo {
  ok: boolean;
  /** Campi obbligatori assenti (etichette in italiano) */
  mancanti: string[];
  /** Campi presenti ma formalmente non validi */
  errori: string[];
  /** Non bloccanti (es. manca l'email per la copia di cortesia) */
  avvisi: string[];
}

/** Controlla che il profilo abbia tutto ciò che serve per una fattura elettronica. */
export function controllaProfilo(p: ProfiloFatturazione): EsitoControllo {
  const mancanti: string[] = [];
  const errori: string[] = [];
  const avvisi: string[] = [];
  const vuoto = (v: string | null | undefined) => !v || !v.trim();
  const italia = (p.nazione || "IT").toUpperCase() === "IT";

  if (vuoto(p.ragione_sociale)) mancanti.push(p.tipo === "persona" ? "Nome e cognome" : "Ragione sociale");
  if (vuoto(p.via)) mancanti.push("Indirizzo (via e numero civico)");
  if (vuoto(p.comune)) mancanti.push("Comune");
  if (italia) {
    if (vuoto(p.cap)) mancanti.push("CAP");
    else if (!/^\d{5}$/.test(p.cap!.trim())) errori.push("CAP non valido (5 cifre)");
    if (vuoto(p.provincia)) mancanti.push("Provincia");
    else if (!/^[A-Z]{2}$/i.test(p.provincia!.trim())) errori.push("Provincia non valida (sigla di 2 lettere)");
  }

  if (p.tipo === "persona") {
    if (vuoto(p.codice_fiscale)) mancanti.push("Codice fiscale");
    else if (italia && !codiceFiscaleValido(p.codice_fiscale!)) errori.push("Codice fiscale non valido");
    if (!vuoto(p.partita_iva) && italia && !partitaIvaValida(p.partita_iva!)) errori.push("Partita IVA non valida");
  } else {
    if (vuoto(p.partita_iva) && !(p.tipo === "pa" && !vuoto(p.codice_fiscale))) mancanti.push("Partita IVA");
    else if (!vuoto(p.partita_iva) && italia && !partitaIvaValida(p.partita_iva!)) errori.push("Partita IVA non valida (cifra di controllo errata)");
    if (!vuoto(p.codice_fiscale) && italia && !codiceFiscaleValido(p.codice_fiscale!)) errori.push("Codice fiscale non valido");
  }

  // Recapito SDI: codice destinatario oppure PEC (per l'estero si usa XXXXXXX in automatico)
  if (italia) {
    const codice = (p.codice_destinatario ?? "").trim().toUpperCase();
    const haPec = !vuoto(p.pec);
    if (haPec && !EMAIL.test(p.pec!.trim())) errori.push("PEC non valida");
    if (codice && codice !== "0000000" && !codiceDestinatarioValido(codice, p.tipo)) {
      errori.push(p.tipo === "pa" ? "Codice univoco ufficio non valido (6 caratteri)" : "Codice destinatario non valido (7 caratteri)");
    }
    const recapitoOk = (codice && codice !== "0000000") || haPec || (p.tipo === "persona" && codice === "0000000");
    if (!recapitoOk) {
      mancanti.push(p.tipo === "pa" ? "Codice univoco ufficio" : "Codice destinatario SDI oppure PEC");
    }
  }

  if (vuoto(p.email_amministrativa)) avvisi.push("Manca l'email amministrativa: la copia di cortesia non verrà inviata");
  else if (!EMAIL.test(p.email_amministrativa!.trim())) errori.push("Email amministrativa non valida");

  return { ok: mancanti.length === 0 && errori.length === 0, mancanti, errori, avvisi };
}

/** Normalizza i dati (maiuscole, spazi) prima di salvarli o inviarli. */
export function normalizzaProfilo(p: ProfiloFatturazione): ProfiloFatturazione {
  const t = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const u = (v: string | null | undefined) => t(v)?.toUpperCase().replace(/\s+/g, "") ?? null;
  return {
    ...p,
    ragione_sociale: t(p.ragione_sociale),
    partita_iva: u(p.partita_iva)?.replace(/^IT(?=\d{11}$)/, "") ?? null,
    codice_fiscale: u(p.codice_fiscale),
    via: t(p.via),
    cap: t(p.cap),
    comune: t(p.comune),
    provincia: u(p.provincia),
    nazione: u(p.nazione) ?? "IT",
    codice_destinatario: u(p.codice_destinatario),
    pec: t(p.pec)?.toLowerCase() ?? null,
    email_amministrativa: t(p.email_amministrativa)?.toLowerCase() ?? null,
  };
}

/** Chiavi dei metadata del Customer Stripe che contengono gli stessi dati. */
export const CHIAVI_METADATA = [
  "tipo", "ragione_sociale", "partita_iva", "codice_fiscale", "via", "cap", "comune", "provincia", "nazione",
  "codice_destinatario", "pec", "email_amministrativa",
] as const;

export function profiloDaMetadata(customerId: string, m: Record<string, string>): ProfiloFatturazione {
  const tipo = m.tipo === "persona" || m.tipo === "pa" ? m.tipo : "azienda";
  return normalizzaProfilo({
    stripe_customer_id: customerId,
    tipo,
    ragione_sociale: m.ragione_sociale ?? null,
    partita_iva: m.partita_iva ?? null,
    codice_fiscale: m.codice_fiscale ?? null,
    via: m.via ?? null,
    cap: m.cap ?? null,
    comune: m.comune ?? null,
    provincia: m.provincia ?? null,
    nazione: m.nazione ?? "IT",
    codice_destinatario: m.codice_destinatario ?? null,
    pec: m.pec ?? null,
    email_amministrativa: m.email_amministrativa ?? null,
  });
}

export function metadataDaProfilo(p: ProfiloFatturazione): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of CHIAVI_METADATA) out[k] = String((p as unknown as Record<string, unknown>)[k] ?? "");
  return out;
}
