import type { EditStyle, LLMProvider, ProviderCost } from "@nexora/shared/server";
import {
  defaultFraming,
  remapWords,
  type EditSpec,
  EditSpecSchema,
  type MusicMood,
  type MusicTrack,
  pickTrack,
  segmentsFromWordRanges,
  silenceCut,
  type SourceInfo,
  totalDuration,
  type Word,
} from "@nexora/video-engine";
import { z } from "zod";

/** Output del modello: decisioni editoriali, non tempi (quelli li calcoliamo noi dalle parole). */
export const EditPlanSchema = z.object({
  keep: z
    .array(z.object({ from_word: z.number().int(), to_word: z.number().int() }))
    .describe("Intervalli di parole da tenere (indici inclusivi), nell'ordine in cui vanno riprodotti"),
  highlight_words: z.array(z.number().int()).describe("Indici delle parole chiave da evidenziare (poche)"),
  hook_overlay: z.string().nullable().describe("Testo breve a schermo nei primi 3 secondi, max 6 parole, o null"),
  music_mood: z.enum(["energica", "rilassata", "elegante", "nessuna"]),
  subtitle_size: z.enum(["piccoli", "medi", "grandi"]).nullable().describe("Solo se la richiesta lo chiede, altrimenti null"),
  subtitle_style: z.enum(["pulito", "evidenziato", "karaoke"]).nullable().describe("Solo se la richiesta lo chiede, altrimenti null"),
  music_volume: z.enum(["bassa", "media", "alta"]).nullable().describe("Solo se la richiesta lo chiede, altrimenti null"),
  broll: z
    .array(
      z.object({
        at_word: z.number().int().describe("Indice della parola su cui far partire la clip (la voce continua sotto)"),
        duration_s: z.number().describe("Durata della clip in secondi, 2-4"),
        query_en: z.string().describe("Cosa mostrare, 2-4 parole in inglese, concreto (es. 'pizza oven fire')"),
      }),
    )
    .describe("Immagini di supporto (stock) nei punti in cui si parla di qualcosa che si può mostrare"),
  caption: z.string().describe("Didascalia per i social in italiano, 1-3 frasi, con invito all'azione, senza hashtag"),
  hashtags: z.array(z.string()).describe("5-8 hashtag in italiano senza #, anche locali"),
  notes: z.string().describe("In una frase: cosa hai tagliato e perché (per il team)"),
});
export type EditPlan = z.infer<typeof EditPlanSchema>;

export const EDIT_SYSTEM_PROMPT = `Sei il montatore di Nexora Studio. Ricevi la trascrizione parola per parola di un video verticale girato col telefono dal titolare di una piccola azienda italiana, e decidi il montaggio.

Il tuo compito:
- keep: scegli gli intervalli di parole da tenere (indici inclusivi). Togli false partenze, frasi ripetute, errori corretti subito dopo ("anzi no", "ricomincio"), intercalari ("ehm", "allora...", "cioè") quando non servono, divagazioni. Se una frase è stata detta più volte, tieni l'ultima versione completa. Non tagliare a metà una frase che serve al senso.
- L'ordine di keep è l'ordine di riproduzione: di solito quello originale. Puoi spostare all'inizio una frase d'aggancio forte solo se è chiaramente migliore come apertura.
- Durata: un reel funziona tra 20 e 60 secondi. Taglia il superfluo, ma non inventare e non riassumere: puoi solo togliere.
- highlight_words: 1 parola chiave ogni 4-8 parole al massimo (numeri, promesse, nomi di prodotti). Mai parole vuote.
- hook_overlay: una scritta breve (max 6 parole) che rinforza l'apertura, oppure null se il video parla già da solo.
- music_mood: scegli in base al tono del brand e del contenuto; "nessuna" se la musica disturberebbe.
- broll: clip stock a schermo intero nei punti in cui si parla di qualcosa di concreto da mostrare (un prodotto, un luogo, un'azione). Mai nei primi 3 secondi, mai mentre il titolare mostra lui stesso qualcosa. Rispetta il numero massimo indicato.
- caption e hashtags: in italiano, coerenti con il brand e la città; niente promesse o dati non detti nel video.
- subtitle_size, subtitle_style, music_volume: lasciali null, salvo che la richiesta di modifica del cliente li riguardi.

Le pause lunghe nella trascrizione sono segnate con ‖. Gli indici sono tra parentesi quadre.
Rispondi solo con il JSON richiesto.`;

export interface PlanContext {
  brand: { companyName: string; city: string | null; toneOfVoice: string | null; doNotSay: string | null; editStyle: EditStyle };
  script: { title: string; hook: string; body: string } | null;
  words: Word[];
  previous?: { plan: EditPlan; feedback: string };
}

export function transcriptForPrompt(words: Word[]) {
  return words
    .map((w, i) => {
      const gap = i > 0 ? w.start - words[i - 1]!.end : 0;
      return `${gap > 0.6 ? "‖ " : ""}[${i}]${w.text}`;
    })
    .join(" ");
}

export function editUserPrompt(ctx: PlanContext) {
  const style = ctx.brand.editStyle;
  const parts = [
    `AZIENDA\n- Nome: ${ctx.brand.companyName}${ctx.brand.city ? `\n- Città: ${ctx.brand.city}` : ""}${ctx.brand.toneOfVoice ? `\n- Tono: ${ctx.brand.toneOfVoice}` : ""}${ctx.brand.doNotSay ? `\n- Da non dire: ${ctx.brand.doNotSay}` : ""}`,
    `STILE DI MONTAGGIO PREFERITO\n- Ritmo: ${style.pace ?? "medio"}\n- Musica: ${style.music?.mood ?? "energica"}\n- B-roll: massimo ${maxBroll(style)} clip`,
    ctx.script
      ? `SCRIPT DI RIFERIMENTO (il titolare può essersi discostato)\n- Titolo: ${ctx.script.title}\n- Apertura prevista: ${ctx.script.hook}\n- Testo: ${ctx.script.body.replace(/\n+/g, " ")}`
      : "SCRIPT DI RIFERIMENTO\n- Nessuno: video libero.",
    `TRASCRIZIONE (PAROLE TOTALI: ${ctx.words.length})\n${transcriptForPrompt(ctx.words)}`,
  ];
  if (ctx.previous) {
    parts.push(
      `MONTAGGIO PRECEDENTE\n${JSON.stringify({ keep: ctx.previous.plan.keep, hook_overlay: ctx.previous.plan.hook_overlay, music_mood: ctx.previous.plan.music_mood })}`,
      `RICHIESTA DI MODIFICA DEL CLIENTE\n${ctx.previous.feedback}\n\nApplica la richiesta partendo dal montaggio precedente e cambia solo ciò che serve.`,
    );
  } else {
    parts.push("RICHIESTA\nDecidi il montaggio.");
  }
  return parts.join("\n\n");
}

/** Numero massimo di clip b-roll secondo lo stile scelto dall'azienda. */
export function maxBroll(style: EditStyle) {
  return { nessuno: 0, poco: 2, spesso: 4 }[style.broll_usage ?? "poco"];
}

export async function planEdit(llm: LLMProvider, ctx: PlanContext): Promise<{ plan: EditPlan; cost: ProviderCost }> {
  const res = await llm.generateObject({
    system: EDIT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: editUserPrompt(ctx) }],
    schema: EditPlanSchema,
    effort: "medium",
  });
  return { plan: res.data, cost: res.cost };
}

const MUSIC_VOLUME = { bassa: 0.07, media: 0.11, alta: 0.16 } as const;

/** Dalle decisioni del modello all'edit_spec deterministico (con controlli e ripieghi). */
export function planToSpec(args: {
  plan: EditPlan;
  words: Word[];
  source: SourceInfo;
  editStyle: EditStyle;
  brandColor: string | null;
  music: MusicTrack[];
  seed: string;
  hasLogo: boolean;
  previousSpec?: EditSpec | null;
}): EditSpec {
  const { plan, words, source, editStyle } = args;
  const n = words.length;
  const ranges = plan.keep
    .map((r) => ({ from: Math.max(0, Math.min(n - 1, r.from_word)), to: Math.max(0, Math.min(n - 1, r.to_word)) }))
    .filter((r) => n > 0 && r.to >= r.from);

  let segments = n > 0 && ranges.length ? segmentsFromWordRanges(words, ranges, source.durationS) : [];
  // Ripiego: se il modello ha tenuto troppo poco (o niente), solo taglio dei silenzi.
  if (segments.length === 0 || totalDuration(segments) < Math.min(5, source.durationS * 0.3)) {
    segments = silenceCut(words, source.durationS);
  }

  const keptIdx = new Set(ranges.flatMap((r) => Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i)));
  const mood = plan.music_mood;
  const track = mood === "nessuna" ? null : pickTrack(args.music, mood as MusicMood, args.seed);
  const prevVolume = args.previousSpec?.music?.volume;

  const spec: EditSpec = {
    version: 1,
    segments,
    subtitles: {
      enabled: true,
      style: plan.subtitle_style ?? args.previousSpec?.subtitles.style ?? editStyle.subtitles?.style ?? "evidenziato",
      size: plan.subtitle_size ?? args.previousSpec?.subtitles.size ?? editStyle.subtitles?.size ?? "medi",
      highlightWordIndices: plan.highlight_words.filter((i) => keptIdx.size === 0 || keptIdx.has(i)).slice(0, 40),
      highlightColor: args.brandColor && /^#[0-9a-f]{6}$/i.test(args.brandColor) ? args.brandColor : "#0A5CFF",
      font: "Inter",
    },
    music: track
      ? { trackId: track.id, volume: plan.music_volume ? MUSIC_VOLUME[plan.music_volume] : (prevVolume ?? MUSIC_VOLUME.media) }
      : null,
    hookOverlay: plan.hook_overlay?.trim() ? plan.hook_overlay.trim().slice(0, 60) : null,
    outroLogo: (editStyle.logo_outro ?? true) && args.hasLogo,
    framing: defaultFraming(source),
    broll: placeBroll(plan, words, segments, maxBroll(editStyle)),
  };
  return EditSpecSchema.parse(spec);
}

/**
 * Dalle proposte del modello alle posizioni nel video montato, con regole fisse:
 * dopo la frase d'apertura (3 s), mai nell'ultimo secondo, 2-4 s ciascuna, almeno 1,5 s tra due clip.
 */
export function placeBroll(plan: EditPlan, words: Word[], segments: { start: number; end: number }[], max: number) {
  if (max <= 0) return [];
  const timed = remapWords(words, segments);
  const total = totalDuration(segments);
  const placed: EditSpec["broll"] = [];
  const sorted = [...plan.broll].sort((a, b) => a.at_word - b.at_word);
  for (const b of sorted) {
    if (placed.length >= Math.min(max, Math.floor(total / 8))) break;
    const w = timed.find((t) => t.index >= b.at_word);
    if (!w || !b.query_en.trim()) continue;
    const duration = Math.min(4, Math.max(2, b.duration_s || 3));
    const at = Math.max(3, w.start);
    if (at + duration > total - 1) continue;
    const last = placed[placed.length - 1];
    if (last && at < last.at + last.duration + 1.5) continue;
    placed.push({ at: Math.round(at * 100) / 100, duration, query: b.query_en.trim().slice(0, 60), storagePath: null });
  }
  return placed;
}
