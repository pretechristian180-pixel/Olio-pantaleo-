import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Course } from "@/lib/data/courses";
import { formatDuration, formatPrice } from "@/lib/utils";
import {
  aiLandingSchema,
  REGEN_MODES,
  type AiLanding,
  type Brief,
  type RegenMode,
  type Section,
  type SectionType,
} from "./sections";

export const AI_MODEL = "claude-opus-5-5";

export class AiUnavailableError extends Error {}

function client() {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new AiUnavailableError("La generazione con l'IA non è configurata.");
  return new Anthropic({ timeout: 120_000, maxRetries: 2 });
}

const TONI: Record<Brief["tono"], string> = {
  diretto: "diretto e concreto, frasi brevi, zero giri di parole",
  rassicurante: "caldo e rassicurante, toglie le paure senza minimizzarle",
  tecnico: "preciso e competente, per chi vuole capire i dettagli",
  energico: "energico e motivante, ma sempre credibile",
};

const SYSTEM = `Sei un copywriter italiano esperto di landing page per corsi online di piccole aziende e professionisti.
Scrivi in italiano semplice, al "tu", con frasi concrete. Niente gergo da agenzia, niente emoji, niente punti esclamativi in serie.

Regole che non puoi violare:
- Usa solo i fatti forniti (dati del corso e brief). Non inventare numeri, risultati garantiti, guadagni, statistiche, nomi di clienti o testimonianze.
- Se il brief non indica bonus, lascia la lista dei bonus vuota. Se non indica una garanzia, lascia vuoto il testo della garanzia.
- Non promettere risultati che dipendono da fattori esterni ("diventerai ricco", "raddoppierai i clienti").
- Titoli brevi (massimo 12 parole). Pulsanti di 2-4 parole.
- "Cosa porti a casa": 3-6 risultati concreti, ognuno con un titolo breve e una frase.
- "Il problema": 3-5 situazioni in cui chi legge si riconosce, scritte come le direbbe lui.
- "Per chi è": 3-5 profili sì, 2-3 profili no (onestà = fiducia).
- Domande frequenti: 4-6 domande vere che frenano l'acquisto (durata, accesso, livello richiesto, pagamento), con risposte basate sui dati forniti.
- Programma e docente vengono mostrati in automatico dai dati del corso: scrivi solo titolo e una breve introduzione.`;

function courseFacts(course: Course, nomeAcademy: string) {
  const lezioni = course.outline.moduli
    .map((m) => `- Modulo ${m.numero}: ${m.titolo} (${m.lezioni.map((l) => l.titolo).join("; ")})`)
    .join("\n");
  return [
    `Academy: ${nomeAcademy}`,
    `Corso: ${course.titolo}`,
    course.sottotitolo ? `Promessa attuale: ${course.sottotitolo}` : null,
    course.categoria ? `Categoria: ${course.categoria}` : null,
    `Prezzo: ${course.prezzo_cents ? formatPrice(course.prezzo_cents, course.valuta) : "gratuito"}`,
    `Durata: ${course.outline.totaleLezioni} lezioni video, ${formatDuration(course.outline.totaleDurataSec)}; accesso illimitato, anche da telefono; materiali scaricabili; attestato di completamento.`,
    course.outline.lezioniGratuite
      ? `Lezioni gratuite di prova: ${course.outline.lezioniGratuite}`
      : null,
    course.docente
      ? `Docente: ${course.docente.nome}${course.docente.qualifica ? `, ${course.docente.qualifica}` : ""}`
      : null,
    `Programma:\n${lezioni || "(non ancora definito)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function briefText(b: Brief) {
  return [
    `A chi si rivolge: ${b.pubblico}`,
    `Problema che risolve: ${b.problema}`,
    `Risultato per chi finisce: ${b.risultato}`,
    b.obiezioni
      ? `Dubbi che frenano l'acquisto: ${b.obiezioni}`
      : "Dubbi che frenano l'acquisto: (non indicati)",
    b.bonus ? `Bonus inclusi: ${b.bonus}` : "Bonus inclusi: nessuno",
    b.garanzia ? `Garanzia: ${b.garanzia}` : "Garanzia: nessuna",
    `Tono: ${TONI[b.tono]}`,
    b.note ? `Note del titolare: ${b.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

type Usage = { input_tokens: number; output_tokens: number };

async function call<T>(schema: Parameters<typeof betaZodOutputFormat>[0], prompt: string) {
  const res = await client().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
  });
  if (res.stop_reason === "refusal")
    throw new Error("L'IA non ha potuto scrivere questo testo. Prova a riformulare il brief.");
  if (res.stop_reason === "max_tokens" || !res.parsed_output)
    throw new Error("La risposta dell'IA è incompleta. Riprova.");
  return { data: res.parsed_output as T, usage: res.usage as Usage, model: res.model };
}

/** Scrive tutta la landing a partire dal corso e dal brief. */
export async function generateLandingCopy(course: Course, nomeAcademy: string, brief: Brief) {
  const prompt = `Scrivi i testi della landing di vendita di questo corso.

DATI DEL CORSO
${courseFacts(course, nomeAcademy)}

BRIEF DEL TITOLARE
${briefText(brief)}`;
  return call<AiLanding>(aiLandingSchema, prompt);
}

/** Riscrive una sola sezione secondo il comando scelto. */
export async function regenerateSectionCopy(
  course: Course,
  nomeAcademy: string,
  brief: Brief,
  section: Section,
  mode: RegenMode,
) {
  const tipo = section.tipo as SectionType;
  const schema = aiLandingSchema.shape[tipo];
  const prompt = `Riscrivi una sezione della landing di vendita di questo corso.

DATI DEL CORSO
${courseFacts(course, nomeAcademy)}

BRIEF DEL TITOLARE
${briefText(brief)}

SEZIONE "${tipo}" ATTUALE (JSON)
${JSON.stringify(section.dati)}

COSA FARE
${REGEN_MODES[mode]}`;
  return call<unknown>(schema, prompt);
}
