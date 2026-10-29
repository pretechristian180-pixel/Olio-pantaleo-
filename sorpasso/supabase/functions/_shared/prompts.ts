/**
 * PROMPT AI DI SORPASSO — file centrale.
 *
 * Qui si modificano i testi che guidano l'AI. Ogni funzione riceve i dati già
 * letti dal database (rispettando i permessi dell'utente) e restituisce:
 *   - system: il ruolo e le regole fisse
 *   - user:   la richiesta con i dati del caso
 *
 * Regole generali valide per tutti i prompt:
 *   - sempre in italiano, tono professionale e concreto;
 *   - mai inventare dati (prezzi, km, optional, disponibilità) che non sono nei dati;
 *   - testo pronto da usare, senza premesse ("Ecco la bozza…").
 */

export interface DatiVeicolo {
  marca: string;
  modello: string;
  versione?: string | null;
  anno?: number | null;
  km?: number | null;
  alimentazione?: string | null;
  cambio?: string | null;
  colore?: string | null;
  tipo?: string | null;
  prezzo_vendita?: number | null;
  note_interne?: string | null;
}

export interface DatiLead {
  cliente: string;
  fonte: string;
  stato: string;
  richiesta?: string | null;
  budget?: number | null;
  permuta: boolean;
  permuta_dati?: Record<string, unknown> | null;
  finanziamento: boolean;
  tempistica: string;
  prossima_azione?: string | null;
  veicolo?: DatiVeicolo | null;
  /** L'auto di interesse è stata venduta a un altro cliente. */
  veicolo_venduto?: boolean;
  interesse?: string | null;
  /** Storico dal più vecchio al più recente, già ridotto alle ultime attività. */
  storico: { data: string; tipo: string; testo: string }[];
}

const REGOLE_BASE = `Scrivi sempre in italiano corretto, con tono professionale, cordiale e concreto.
Non inventare mai informazioni che non sono nei dati forniti (prezzi, chilometri, optional, garanzie, disponibilità, promozioni).
Restituisci solo il testo richiesto, senza premesse, titoli o commenti.`;

const euro = (n?: number | null) =>
  n == null ? "non indicato" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function descriviVeicolo(v: DatiVeicolo): string {
  return [
    `Marca e modello: ${v.marca} ${v.modello}${v.versione ? ` ${v.versione}` : ""}`,
    v.tipo && `Tipo: ${v.tipo}`,
    v.anno && `Anno: ${v.anno}`,
    v.km != null && `Chilometri: ${v.km.toLocaleString("it-IT")}`,
    v.alimentazione && `Alimentazione: ${v.alimentazione}`,
    v.cambio && `Cambio: ${v.cambio}`,
    v.colore && `Colore: ${v.colore}`,
    v.prezzo_vendita != null && `Prezzo: ${euro(v.prezzo_vendita)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function descriviLead(l: DatiLead): string {
  const storico = l.storico.length
    ? l.storico.map((a) => `- ${a.data} · ${a.tipo}: ${a.testo}`).join("\n")
    : "- nessuna attività registrata";
  return `Cliente: ${l.cliente}
Fonte del contatto: ${l.fonte}
Fase della trattativa: ${l.stato}
Richiesta iniziale: ${l.richiesta || "non indicata"}
Auto di interesse: ${l.veicolo ? `${l.veicolo.marca} ${l.veicolo.modello}${l.veicolo.versione ? ` ${l.veicolo.versione}` : ""} (${euro(l.veicolo.prezzo_vendita)})` : l.interesse || "non indicata"}${l.veicolo_venduto ? " — ATTENZIONE: già venduta a un altro cliente" : ""}
Budget: ${euro(l.budget)}
Permuta: ${l.permuta ? `sì${l.permuta_dati ? ` (${Object.values(l.permuta_dati).filter(Boolean).join(", ")})` : ""}` : "no"}
Finanziamento: ${l.finanziamento ? "sì" : "no"}
Tempistica d'acquisto: ${l.tempistica}
Prossima azione prevista: ${l.prossima_azione || "nessuna"}
Storico attività:
${storico}`;
}

/** "Genera descrizione annuncio" — scheda veicolo. */
export function promptDescrizioneAnnuncio(v: DatiVeicolo, azienda: string) {
  return {
    system: `Sei un copywriter esperto di annunci auto per concessionarie italiane (AutoScout24, Subito, sito aziendale).
${REGOLE_BASE}
Struttura dell'annuncio:
1. Una frase d'apertura che presenta l'auto e il suo punto di forza principale.
2. Un paragrafo breve con i dati chiave (anno, km, alimentazione, cambio) scritti in modo scorrevole.
3. Un elenco puntato di 3-5 motivi concreti per sceglierla, basati solo sui dati forniti.
4. Una chiusura con invito a contattare o visitare la concessionaria ${azienda}.
Lunghezza: 120-180 parole. Niente emoji, niente punti esclamativi multipli, niente MAIUSCOLE.`,
    user: `Scrivi l'annuncio per questa auto.
${descriviVeicolo(v)}
${v.note_interne ? `Note del venditore (usale solo se utili per l'annuncio, non citare difetti o costi interni): ${v.note_interne}` : ""}`,
  };
}

/** "Suggerisci risposta" — scheda lead. Bozza che il venditore modifica prima di inviare. */
export function promptSuggerisciRisposta(l: DatiLead, canale: "whatsapp" | "email", venditore: string, azienda: string) {
  const formato =
    canale === "whatsapp"
      ? "Messaggio WhatsApp: massimo 60 parole, dai del Lei se il cliente non ha usato il tu, nessun oggetto, al massimo una emoji."
      : "Email: inizia con la riga 'Oggetto: …', poi una riga vuota e il testo (massimo 130 parole), chiudi con la firma.";
  return {
    system: `Sei ${venditore}, venditore della concessionaria ${azienda}. Scrivi la prossima risposta al cliente.
${REGOLE_BASE}
Obiettivo: far fare al cliente un passo avanti concreto (fissare test drive o visita, ricevere un preventivo, chiudere la trattativa) in base alla fase in cui si trova.
Chiudi sempre con una domanda o una proposta precisa (giorno/orario, chiamata, preventivo).
Se l'auto di interesse è stata venduta, proponi con tatto di cercare alternative simili.
${formato}`,
    user: `Dati del cliente e storico:
${descriviLead(l)}

Scrivi la bozza ${canale === "whatsapp" ? "del messaggio WhatsApp" : "dell'email"}. Firma come ${venditore}.`,
  };
}

/** "Riassunto lead" — 3 righe. */
export function promptRiassuntoLead(l: DatiLead) {
  return {
    system: `Sei il responsabile vendite di una concessionaria. Riassumi un lead per un collega che deve richiamarlo tra un minuto.
${REGOLE_BASE}
Rispondi con esattamente 3 righe, ognuna con questa etichetta:
Cosa vuole: …
A che punto siamo: …
Prossima mossa: … (un'azione concreta con il canale e, se sensato, quando)
Ogni riga al massimo 25 parole.`,
    user: descriviLead(l),
  };
}
