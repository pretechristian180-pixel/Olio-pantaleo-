import type { EditStyle } from "../domain.js";

/**
 * System prompt STABILE (uguale per tutte le aziende e tutte le settimane): così resta in cache
 * presso il provider e ogni generazione paga solo la parte variabile.
 * Non inserire qui date, nomi o dati dell'azienda.
 */
export const SCRIPT_SYSTEM_PROMPT = `Sei lo sceneggiatore di Nexora Studio. Scrivi script per video verticali brevi (Instagram Reels, TikTok, YouTube Shorts) che il titolare di una piccola azienda italiana gira da solo con il telefono, tra un cliente e l'altro.

Chi gira non è un attore e non ha una troupe. Ogni script deve essere:
- girabile in 10-15 minuti, nel posto di lavoro, con il solo telefono;
- detto con parole sue: italiano parlato, frasi corte, niente gergo da marketing, niente slogan vuoti, niente emoji nel testo da dire;
- utile o interessante per il cliente: un consiglio, un dietro le quinte, una risposta a una domanda frequente, una storia vera, un prodotto spiegato bene;
- onesto: non inventare premi, numeri, recensioni, prezzi, promozioni o fatti sull'azienda che non ti sono stati dati. Se ti serve un dettaglio che non conosci, scrivi lo script in modo che il titolare lo dica con parole sue (es. "racconta come hai iniziato").

Struttura di ogni script:
- hook: la frase dei primi 3 secondi. Deve fermare lo scroll: una domanda concreta, un errore comune, una promessa precisa, una situazione riconoscibile. Massimo 15 parole. Mai "Ciao a tutti", mai "In questo video".
- body: il testo da dire in camera, 30-60 secondi a voce (circa 80-150 parole), una frase per riga.
- call_to_action: una chiusura naturale (passare in negozio, prenotare, scrivere in direct, salvare il video). Una sola, adatta al tema.
- shooting_notes: indicazioni pratiche e specifiche per quel video (dove mettersi, come tenere il telefono, che luce cercare, durata, 2-4 consigli). Pensa a chi gira da solo.
- format: talking_head (parla in camera), tutorial (mostra come si fa), behind_the_scenes (dietro le quinte), product (prodotto o servizio in primo piano), testimonial (racconto di un cliente o di un caso vero, senza inventarlo).
- topic_tags: 2-4 parole chiave del tema, minuscole.

Regole per la settimana:
- Varia i formati e gli argomenti: due script della stessa settimana non devono trattare lo stesso tema.
- Non ripetere temi, hook o titoli già usati nelle settimane precedenti (te li elenco). Un tema simile va bene solo con un angolo chiaramente diverso.
- Usa le date e la stagione solo quando c'entrano davvero con l'attività; non forzarle.
- Rispetta il tono di voce dell'azienda e la lista delle cose da non dire.

Rispondi solo con il JSON richiesto.`;

export interface BrandContext {
  companyName: string;
  sector: string | null;
  city: string | null;
  toneOfVoice: string | null;
  targetAudience: string | null;
  services: string | null;
  doNotSay: string | null;
  editStyle?: EditStyle;
}

export interface PastScript {
  weekStart: string;
  title: string;
  hook: string;
  topicTags: string[];
}

function line(label: string, value: string | null | undefined) {
  return value && value.trim() ? `- ${label}: ${value.trim()}` : null;
}

export function brandBlock(brand: BrandContext) {
  return [
    "AZIENDA",
    line("Nome", brand.companyName),
    line("Settore", brand.sector),
    line("Città", brand.city),
    line("Tono di voce", brand.toneOfVoice),
    line("Si rivolge a", brand.targetAudience),
    line("Servizi e prodotti", brand.services),
    line("Da non dire mai", brand.doNotSay),
  ]
    .filter(Boolean)
    .join("\n");
}

export function historyBlock(past: PastScript[]) {
  if (past.length === 0) return "SCRIPT DELLE SETTIMANE PRECEDENTI\n- Nessuno: è la prima settimana.";
  const rows = past.map(
    (p) => `- [${p.weekStart}] ${p.title} — hook: "${p.hook}" — temi: ${p.topicTags.join(", ") || "n/d"}`,
  );
  return `SCRIPT DELLE SETTIMANE PRECEDENTI (da non ripetere)\n${rows.join("\n")}`;
}

export function calendarBlock(ctx: { season: string; upcoming: { date: string; label: string }[] }) {
  const dates = ctx.upcoming.length
    ? ctx.upcoming.map((d) => `- ${d.date}: ${d.label}`).join("\n")
    : "- Nessuna ricorrenza particolare nelle prossime tre settimane.";
  return `PERIODO\n- Stagione: ${ctx.season}\nDate in arrivo:\n${dates}`;
}

export function weeklyUserPrompt(args: {
  brand: BrandContext;
  weekStart: string;
  count: number;
  past: PastScript[];
  calendar: { season: string; upcoming: { date: string; label: string }[] };
}) {
  return [
    brandBlock(args.brand),
    calendarBlock(args.calendar),
    historyBlock(args.past),
    `RICHIESTA\nScrivi ${args.count} script per la settimana che inizia lunedì ${args.weekStart}. Restituisci esattamente ${args.count} script, tutti su temi diversi tra loro e dalle settimane precedenti.`,
  ].join("\n\n");
}

export function regenerateUserPrompt(args: {
  brand: BrandContext;
  weekStart: string;
  current: { title: string; hook: string; format: string };
  siblings: { title: string; hook: string }[];
  past: PastScript[];
  calendar: { season: string; upcoming: { date: string; label: string }[] };
  feedback?: string;
}) {
  const siblings = args.siblings.length
    ? args.siblings.map((s) => `- ${s.title} — hook: "${s.hook}"`).join("\n")
    : "- Nessuno";
  return [
    brandBlock(args.brand),
    calendarBlock(args.calendar),
    historyBlock(args.past),
    `ALTRI SCRIPT DI QUESTA SETTIMANA (non sovrapporti)\n${siblings}`,
    `SCRIPT DA SOSTITUIRE\n- ${args.current.title} — hook: "${args.current.hook}" (formato ${args.current.format})`,
    args.feedback?.trim()
      ? `COSA NON ANDAVA BENE, SECONDO IL TITOLARE\n${args.feedback.trim()}`
      : null,
    `RICHIESTA\nScrivi un solo script nuovo per la settimana del ${args.weekStart}, su un tema diverso da quello da sostituire e dagli altri elencati.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
