import { z } from "zod";

/**
 * Sezioni della landing di vendita. Il contenuto lo scrive l'IA (o il titolare); grafica e
 * ordine li decide la piattaforma, così ogni landing è bella e coerente col marchio.
 * Logica pura: usata da server, editor e pagina pubblica.
 */

const s = (max: number) =>
  z
    .string()
    .catch("")
    .transform((v) => v.trim().slice(0, max));
const list = (max: number, n: number) =>
  z
    .array(s(max))
    .catch([])
    .transform((a) => a.filter(Boolean).slice(0, n));
const items = (n: number) =>
  z
    .array(z.object({ titolo: s(120), testo: s(600) }))
    .catch([])
    .transform((a) => a.filter((x) => x.titolo).slice(0, n));
const faqItems = (n: number) =>
  z
    .array(z.object({ domanda: s(200), risposta: s(800) }))
    .catch([])
    .transform((a) => a.filter((x) => x.domanda && x.risposta).slice(0, n));

export const sectionData = {
  hero: z.object({ sopratitolo: s(80), titolo: s(140), sottotitolo: s(320), cta: s(40) }),
  problema: z.object({ titolo: s(140), intro: s(400), punti: list(200, 6) }),
  risultati: z.object({ titolo: s(140), items: items(6) }),
  per_chi: z.object({ titolo: s(140), si: list(200, 6), no: list(200, 5) }),
  programma: z.object({ titolo: s(140), intro: s(300) }),
  docente: z.object({ titolo: s(140) }),
  bonus: z.object({ titolo: s(140), items: items(5) }),
  garanzia: z.object({ titolo: s(140), testo: s(500) }),
  faq: z.object({ titolo: s(140), items: faqItems(8) }),
  cta_finale: z.object({ titolo: s(140), testo: s(400), cta: s(40) }),
} as const;

export type SectionType = keyof typeof sectionData;
export const SECTION_ORDER: SectionType[] = [
  "hero",
  "problema",
  "risultati",
  "per_chi",
  "programma",
  "docente",
  "bonus",
  "garanzia",
  "faq",
  "cta_finale",
];

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Apertura",
  problema: "Il problema",
  risultati: "Cosa porti a casa",
  per_chi: "Per chi è (e per chi no)",
  programma: "Programma",
  docente: "Chi ti accompagna",
  bonus: "Bonus",
  garanzia: "Garanzia",
  faq: "Domande frequenti",
  cta_finale: "Chiusura",
};

export type SectionDataMap = { [K in SectionType]: z.infer<(typeof sectionData)[K]> };
export type Section = {
  [K in SectionType]: { id: string; tipo: K; visibile: boolean; dati: SectionDataMap[K] };
}[SectionType];

/** Schema che l'IA deve rispettare: un campo per sezione. */
export const aiLandingSchema = z.object({
  hero: z.object({
    sopratitolo: z.string(),
    titolo: z.string(),
    sottotitolo: z.string(),
    cta: z.string(),
  }),
  problema: z.object({ titolo: z.string(), intro: z.string(), punti: z.array(z.string()) }),
  risultati: z.object({
    titolo: z.string(),
    items: z.array(z.object({ titolo: z.string(), testo: z.string() })),
  }),
  per_chi: z.object({ titolo: z.string(), si: z.array(z.string()), no: z.array(z.string()) }),
  programma: z.object({ titolo: z.string(), intro: z.string() }),
  docente: z.object({ titolo: z.string() }),
  bonus: z.object({
    titolo: z.string(),
    items: z.array(z.object({ titolo: z.string(), testo: z.string() })),
  }),
  garanzia: z.object({ titolo: z.string(), testo: z.string() }),
  faq: z.object({
    titolo: z.string(),
    items: z.array(z.object({ domanda: z.string(), risposta: z.string() })),
  }),
  cta_finale: z.object({ titolo: z.string(), testo: z.string(), cta: z.string() }),
});
export type AiLanding = z.infer<typeof aiLandingSchema>;

const newId = () => Math.random().toString(36).slice(2, 10);

/** Pulisce un singolo blocco di dati: tronca, toglie vuoti, riempie i campi mancanti. */
export function cleanData<K extends SectionType>(tipo: K, raw: unknown): SectionDataMap[K] {
  return sectionData[tipo].parse(raw ?? {}) as SectionDataMap[K];
}

/** Una sezione senza contenuto utile resta nascosta (es. bonus o garanzia non previsti). */
export function hasContent(sec: Section) {
  const d = sec.dati as Record<string, unknown>;
  if (sec.tipo === "programma" || sec.tipo === "docente") return true;
  if (sec.tipo === "bonus" || sec.tipo === "risultati" || sec.tipo === "faq")
    return (d.items as unknown[]).length > 0;
  if (sec.tipo === "garanzia") return Boolean(d.testo);
  if (sec.tipo === "problema") return (d.punti as unknown[]).length > 0 || Boolean(d.intro);
  if (sec.tipo === "per_chi") return (d.si as unknown[]).length > 0;
  return Boolean(d.titolo);
}

/** Dalla risposta dell'IA alle sezioni della landing, nell'ordine standard. */
export function sectionsFromAi(ai: AiLanding): Section[] {
  return SECTION_ORDER.map((tipo) => {
    const sec = { id: newId(), tipo, visibile: true, dati: cleanData(tipo, ai[tipo]) } as Section;
    return { ...sec, visibile: hasContent(sec) } as Section;
  });
}

/** Valida le sezioni salvate (o inviate dall'editor): scarta tipi sconosciuti, pulisce i dati. */
export function parseSections(raw: unknown): Section[] {
  if (!Array.isArray(raw)) return [];
  const out: Section[] = [];
  for (const r of raw.slice(0, 20)) {
    const x = r as { id?: unknown; tipo?: unknown; visibile?: unknown; dati?: unknown };
    if (typeof x?.tipo !== "string" || !(x.tipo in sectionData)) continue;
    const tipo = x.tipo as SectionType;
    out.push({
      id: typeof x.id === "string" && x.id.length <= 20 ? x.id : newId(),
      tipo,
      visibile: x.visibile !== false,
      dati: cleanData(tipo, x.dati),
    } as Section);
  }
  return out;
}

export const briefSchema = z.object({
  pubblico: z.string().trim().min(10, "Descrivi in una frase a chi si rivolge il corso.").max(600),
  problema: z.string().trim().min(10, "Scrivi qual è il problema principale che risolve.").max(800),
  risultato: z.string().trim().min(10, "Scrivi cosa sa fare chi finisce il corso.").max(800),
  obiezioni: z.string().trim().max(800),
  bonus: z.string().trim().max(600),
  garanzia: z.string().trim().max(300),
  tono: z.enum(["diretto", "rassicurante", "tecnico", "energico"]),
  note: z.string().trim().max(800),
});
export type Brief = z.infer<typeof briefSchema>;

export const REGEN_MODES = {
  rigenera: "Riscrivi la sezione da capo con un taglio diverso, mantenendo i fatti.",
  breve: "Riscrivi la sezione più breve: circa metà delle parole, stesso messaggio.",
  diretto:
    "Riscrivi la sezione più diretta e concreta: frasi corte, verbi d'azione, niente giri di parole.",
  emozionale:
    "Riscrivi la sezione più coinvolgente: parla della situazione vissuta da chi legge e di come cambia, senza esagerare.",
} as const;
export type RegenMode = keyof typeof REGEN_MODES;
