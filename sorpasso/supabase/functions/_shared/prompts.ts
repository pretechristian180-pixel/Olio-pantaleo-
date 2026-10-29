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
  allestimento?: string | null;
  carrozzeria?: string | null;
  porte?: number | null;
  posti?: number | null;
  mese_immatricolazione?: number | null;
  cilindrata?: number | null;
  potenza_kw?: number | null;
  trazione?: string | null;
  classe_euro?: string | null;
  consumo_misto?: number | null;
  emissioni_co2?: number | null;
  colore_interni?: string | null;
  numero_proprietari?: number | null;
  tagliandi_certificati?: boolean | null;
  garanzia_mesi?: number | null;
  garanzia_tipo?: string | null;
  neopatentati?: boolean | null;
  optional?: string[] | null;
  optional_extra?: string | null;
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
  const tipi: Record<string, string> = { nuovo: "nuova", usato: "usata", km0: "km 0", aziendale: "aziendale" };
  return [
    `Marca e modello: ${v.marca} ${v.modello}${v.versione ? ` ${v.versione}` : ""}${v.allestimento ? ` (allestimento ${v.allestimento})` : ""}`,
    v.tipo && `Condizione: ${tipi[v.tipo] ?? v.tipo}`,
    v.carrozzeria && `Carrozzeria: ${v.carrozzeria}${v.porte ? `, ${v.porte} porte` : ""}${v.posti ? `, ${v.posti} posti` : ""}`,
    v.anno && `Immatricolazione: ${v.mese_immatricolazione ? `${String(v.mese_immatricolazione).padStart(2, "0")}/` : ""}${v.anno}`,
    v.km != null && `Chilometri: ${v.km.toLocaleString("it-IT")}`,
    v.alimentazione && `Alimentazione: ${v.alimentazione}`,
    v.cilindrata && `Cilindrata: ${v.cilindrata} cm³`,
    v.potenza_kw && `Potenza: ${v.potenza_kw} kW (${Math.round(v.potenza_kw * 1.35962)} CV)`,
    v.cambio && `Cambio: ${v.cambio}`,
    v.trazione && `Trazione: ${v.trazione}`,
    v.classe_euro && `Classe: ${v.classe_euro}`,
    v.consumo_misto != null && `Consumo misto: ${v.consumo_misto}${v.alimentazione === "elettrica" ? " kWh/100 km" : " l/100 km"}`,
    v.emissioni_co2 != null && `Emissioni CO2: ${v.emissioni_co2} g/km`,
    v.colore && `Colore esterno: ${v.colore}`,
    v.colore_interni && `Interni: ${v.colore_interni}`,
    v.numero_proprietari != null && v.tipo !== "nuovo" && `Proprietari precedenti: ${v.numero_proprietari}`,
    v.tagliandi_certificati && "Tagliandi certificati",
    v.garanzia_mesi && `Garanzia: ${v.garanzia_mesi} mesi${v.garanzia_tipo ? ` (${v.garanzia_tipo})` : ""}`,
    v.neopatentati && "Adatta ai neopatentati",
    v.optional?.length && `Optional ed equipaggiamenti: ${v.optional.join(", ")}`,
    v.optional_extra && `Altri equipaggiamenti: ${v.optional_extra}`,
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

/**
 * "Genera con AI" — scheda veicolo, versione completa per i portali (AutoScout24, Subito, sito).
 * Usa SOLO i dati della scheda tecnica: note interne, difetti e costi non vengono passati all'AI.
 */
export function promptDescrizioneAnnuncio(v: DatiVeicolo, azienda: string) {
  return {
    system: `Sei un copywriter esperto di annunci auto per concessionarie italiane (AutoScout24, Subito, sito aziendale).
${REGOLE_BASE}
Struttura dell'annuncio:
1. Una frase d'apertura che presenta l'auto e il suo punto di forza principale.
2. Un paragrafo con i dati chiave (immatricolazione, km, motore e potenza, cambio, consumi) scritti in modo scorrevole.
3. Un elenco puntato con gli equipaggiamenti più rilevanti, raggruppati (sicurezza, comfort, multimedia), solo tra quelli forniti.
4. Una riga su garanzia, tagliandi e proprietari, se presenti nei dati.
5. Una chiusura con invito a contattare o visitare ${azienda}.
Lunghezza: 150-230 parole. Niente emoji, niente punti esclamativi multipli, niente MAIUSCOLE.`,
    user: `Scrivi l'annuncio completo per questa auto.
${descriviVeicolo(v)}`,
  };
}

/** "Genera con AI" — versione breve per social e WhatsApp. */
export function promptDescrizioneBreve(v: DatiVeicolo, azienda: string) {
  return {
    system: `Sei il social media manager della concessionaria ${azienda}.
${REGOLE_BASE}
Scrivi un testo breve per un post social o un messaggio WhatsApp:
- prima riga: marca, modello e il vantaggio principale;
- 3 righe con i dati chiave, ognuna preceduta da un'emoji pertinente (📅 🛣️ ⛽ ⚙️ 🛡️ 💶);
- ultima riga: invito a scrivere o passare in salone.
Massimo 50 parole in tutto. Usa solo i dati forniti.`,
    user: `Scrivi il testo breve per questa auto.
${descriviVeicolo(v)}`,
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
