/** Etichette in italiano e colori per tutti gli stati. */
import type {
  Alimentazione,
  Cambio,
  ChecklistVoce,
  FonteLead,
  ModalitaPortale,
  RegimeIva,
  Ruolo,
  StatoAnnuncio,
  StatoAppuntamento,
  StatoLead,
  StatoPreventivo,
  StatoVeicolo,
  StatoVoce,
  Tempistica,
  TipoAppuntamento,
  AzioneManuale,
  TipoAttivita,
  TipoDocumento,
  TipoVeicolo,
} from "@/types/db";

export type Tone = "gray" | "blue" | "accent" | "green" | "yellow" | "red" | "purple";

export const toneClasses: Record<Tone, { soft: string; dot: string; solid: string }> = {
  gray: { soft: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60", solid: "bg-muted-foreground" },
  blue: { soft: "bg-primary-soft text-primary", dot: "bg-primary", solid: "bg-primary" },
  accent: { soft: "bg-accent-soft text-accent", dot: "bg-accent", solid: "bg-accent" },
  green: { soft: "bg-success-soft text-success", dot: "bg-success", solid: "bg-success" },
  yellow: { soft: "bg-warning-soft text-warning", dot: "bg-warning", solid: "bg-warning" },
  red: { soft: "bg-destructive-soft text-destructive", dot: "bg-destructive", solid: "bg-destructive" },
  purple: { soft: "bg-violet-50 text-violet-700", dot: "bg-violet-500", solid: "bg-violet-500" },
};

export const RUOLI: Record<Ruolo, string> = {
  titolare: "Titolare",
  responsabile_vendite: "Responsabile vendite",
  venditore: "Venditore",
  amministrazione: "Amministrazione",
};

export const FONTI: Record<FonteLead, string> = {
  autoscout24: "AutoScout24",
  subito: "Subito",
  automobile_it: "Automobile.it",
  sito: "Sito web",
  facebook: "Facebook",
  instagram: "Instagram",
  telefono: "Telefono",
  salone: "Salone",
  passaparola: "Passaparola",
  altro: "Altro",
};

export const STATI_LEAD: Record<StatoLead, { label: string; tone: Tone }> = {
  nuovo: { label: "Nuovo", tone: "accent" },
  contattato: { label: "Contattato", tone: "blue" },
  qualificato: { label: "Qualificato", tone: "blue" },
  test_drive: { label: "Test drive", tone: "purple" },
  preventivo: { label: "Preventivo", tone: "yellow" },
  trattativa: { label: "Trattativa", tone: "yellow" },
  vinto: { label: "Vinto", tone: "green" },
  perso: { label: "Perso", tone: "gray" },
};
/** Ordine delle colonne nel kanban. */
export const PIPELINE: StatoLead[] = ["nuovo", "contattato", "qualificato", "test_drive", "preventivo", "trattativa", "vinto", "perso"];
export const STATI_APERTI: StatoLead[] = ["nuovo", "contattato", "qualificato", "test_drive", "preventivo", "trattativa"];

export const MOTIVI_PERSO = [
  "Prezzo troppo alto",
  "Ha comprato altrove",
  "Valutazione permuta bassa",
  "Finanziamento non approvato",
  "Auto venduta ad altri",
  "Non risponde più",
  "Ha rinunciato all'acquisto",
  "Altro",
];

export const TEMPISTICHE: Record<Tempistica, string> = {
  subito: "Subito",
  entro_1_mese: "Entro 1 mese",
  entro_3_mesi: "Entro 3 mesi",
  oltre: "Oltre 3 mesi",
  non_definita: "Non definita",
};

export const STATI_VEICOLO: Record<StatoVeicolo, { label: string; tone: Tone }> = {
  disponibile: { label: "Disponibile", tone: "green" },
  prenotato: { label: "Prenotato", tone: "yellow" },
  venduto: { label: "Venduto", tone: "gray" },
  in_preparazione: { label: "In preparazione", tone: "blue" },
};

export const TIPI_VEICOLO: Record<TipoVeicolo, string> = { nuovo: "Nuovo", usato: "Usato", km0: "Km 0", aziendale: "Aziendale" };

export const REGIMI_IVA: Record<RegimeIva, { label: string; spiegazione: string }> = {
  ordinario: { label: "IVA ordinaria", spiegazione: "IVA sull'intero prezzo; l'IVA sui costi si detrae." },
  margine: { label: "Regime del margine", spiegazione: "IVA solo sul margine (usato da privati); l'IVA sui costi non si detrae." },
};

/** Semaforo margine rispetto all'obiettivo. */
export const SEMAFORO: Record<"verde" | "giallo" | "rosso", { label: string; tone: Tone }> = {
  verde: { label: "Margine in linea con l'obiettivo", tone: "green" },
  giallo: { label: "Margine sotto l'obiettivo", tone: "yellow" },
  rosso: { label: "In perdita", tone: "red" },
};

export const ALIMENTAZIONI: Record<Alimentazione, string> = {
  benzina: "Benzina",
  diesel: "Diesel",
  gpl: "GPL",
  metano: "Metano",
  ibrida: "Ibrida",
  ibrida_plugin: "Ibrida plug-in",
  elettrica: "Elettrica",
};

export const CAMBI: Record<Cambio, string> = { manuale: "Manuale", automatico: "Automatico" };

export const TIPI_ATTIVITA: Record<TipoAttivita, string> = {
  chiamata: "Chiamata",
  whatsapp: "WhatsApp",
  email: "Email",
  nota: "Nota",
  test_drive: "Test drive",
  preventivo: "Preventivo",
  cambio_stato: "Cambio fase",
};

export const TIPI_APPUNTAMENTO: Record<TipoAppuntamento, { label: string; tone: Tone }> = {
  test_drive: { label: "Test drive", tone: "purple" },
  consegna: { label: "Consegna", tone: "green" },
  valutazione_permuta: { label: "Valutazione permuta", tone: "yellow" },
  officina: { label: "Officina", tone: "gray" },
};

export const STATI_APPUNTAMENTO: Record<StatoAppuntamento, string> = {
  programmato: "Programmato",
  completato: "Completato",
  annullato: "Annullato",
  non_presentato: "Non presentato",
};

export const STATI_PREVENTIVO: Record<StatoPreventivo, { label: string; tone: Tone }> = {
  bozza: { label: "Bozza", tone: "gray" },
  inviato: { label: "Inviato", tone: "blue" },
  accettato: { label: "Accettato", tone: "green" },
  rifiutato: { label: "Rifiutato", tone: "red" },
};

export const TIPI_DOCUMENTO: Record<TipoDocumento, string> = {
  carta_identita: "Carta d'identità",
  patente: "Patente",
  codice_fiscale: "Codice fiscale",
  libretto: "Libretto",
  contratto: "Contratto",
  certificato_proprieta: "Certificato di proprietà",
  perizia: "Perizia",
  altro: "Altro",
};

/** Documenti che si caricano sulla scheda veicolo (sezione privata). */
export const TIPI_DOCUMENTO_VEICOLO: TipoDocumento[] = ["libretto", "certificato_proprieta", "perizia", "altro"];

export const CHECKLIST: { voce: ChecklistVoce; label: string }[] = [
  { voce: "contratto", label: "Contratto firmato" },
  { voce: "documenti_cliente", label: "Documenti cliente" },
  { voce: "finanziamento_approvato", label: "Finanziamento approvato" },
  { voce: "passaggio_proprieta", label: "Passaggio di proprietà" },
  { voce: "assicurazione", label: "Assicurazione" },
  { voce: "preparazione_auto", label: "Preparazione auto" },
  { voce: "consegna", label: "Consegna" },
];

export const STATI_VOCE: Record<StatoVoce, { label: string; tone: Tone }> = {
  da_fare: { label: "Da fare", tone: "gray" },
  in_corso: { label: "In corso", tone: "yellow" },
  fatto: { label: "Fatto", tone: "green" },
};

/** Badge giacenza: verde fino a metà soglia, giallo fino alla soglia, rosso oltre. */
export function toneGiacenza(giorni: number, soglia: number): Tone {
  if (giorni > soglia) return "red";
  if (giorni > soglia / 2) return "yellow";
  return "green";
}

/** Colore del punteggio lead. */
export function tonePunteggio(p: number): Tone {
  if (p >= 70) return "green";
  if (p >= 40) return "yellow";
  return "gray";
}

/** Utility per costruire le <option> di una select. */
export const opzioni = <K extends string>(m: Record<K, string | { label: string }>) =>
  (Object.keys(m) as K[]).map((k) => {
    const v = m[k];
    return { value: k, label: typeof v === "string" ? v : v.label };
  });

/* ---------- Pubblicazione multi-portale ---------- */

export const STATI_ANNUNCIO: Record<StatoAnnuncio, { label: string; tone: Tone }> = {
  bozza: { label: "Non pubblicato", tone: "gray" },
  in_pubblicazione: { label: "In pubblicazione", tone: "accent" },
  pubblicato: { label: "Online", tone: "green" },
  errore: { label: "Errore", tone: "red" },
  sospeso: { label: "Sospeso", tone: "yellow" },
  rimosso: { label: "Rimosso", tone: "gray" },
};

export const MODALITA_PORTALE: Record<ModalitaPortale, { label: string; spiegazione: string }> = {
  api: {
    label: "Collegamento diretto (API)",
    spiegazione: "Sorpasso pubblica, aggiorna e toglie l'annuncio da solo, in pochi minuti. Serve l'abilitazione del portale.",
  },
  feed: {
    label: "File automatico (feed)",
    spiegazione: "Sorpasso prepara un file sempre aggiornato a un indirizzo privato: il portale lo legge da solo a intervalli regolari.",
  },
  manuale: {
    label: "Manuale assistito",
    spiegazione: "Prepariamo testo e foto da copiare sul portale; tu incolli l'indirizzo dell'annuncio e ti avvisiamo quando va aggiornato o tolto.",
  },
};

export const AZIONI_MANUALI: Record<AzioneManuale, { label: string; istruzione: string }> = {
  pubblica: { label: "Pubblica a mano", istruzione: "Crea l'annuncio sul portale con testo e foto qui sotto, poi incolla il suo indirizzo." },
  aggiorna: { label: "Aggiorna a mano", istruzione: "Prezzo, foto o dati sono cambiati: aggiorna l'annuncio sul portale, poi premi «Fatto»." },
  sospendi: { label: "Segna come prenotata", istruzione: "L'auto è prenotata: sospendi l'annuncio o segnalo come prenotato sul portale, poi premi «Fatto»." },
  rimuovi: { label: "Togli l'annuncio", istruzione: "L'auto è venduta: elimina l'annuncio dal portale per non ricevere più richieste, poi premi «Fatto»." },
};

/** Sigle brevi per le icone dei portali nello stock */
export const SIGLE_PORTALI: Record<string, string> = {
  autoscout24: "AS24",
  subito: "Subito",
  automobile_it: "Auto.it",
  meta: "Meta",
  sito: "Sito",
  altro: "Altro",
};
