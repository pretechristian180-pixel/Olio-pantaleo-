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
  subtitle_fixes: z
    .array(
      z.object({
        from_word: z.number().int(),
        to_word: z.number().int(),
        text: z.string().describe("Come va scritto davvero quel pezzo nei sottotitoli"),
      }),
    )
    .describe("Errori di trascrizione da correggere nei sottotitoli (parole capite male), solo nelle parti tenute"),
  hook_overlay: z.string().nullable().describe("Testo breve a schermo nei primi 3 secondi, max 6 parole, o null"),
  music_mood: z.enum(["energica", "rilassata", "elegante", "nessuna"]),
  subtitle_size: z.enum(["piccoli", "medi", "grandi"]).nullable().describe("Solo se indicazioni, riferimento o richiesta lo chiedono, altrimenti null"),
  subtitle_style: z.enum(["pulito", "evidenziato", "karaoke"]).nullable().describe("Solo se indicazioni, riferimento o richiesta lo chiedono, altrimenti null"),
  subtitle_position: z.enum(["alto", "centro", "basso"]).nullable().describe("Solo se indicazioni, riferimento o richiesta lo chiedono, altrimenti null"),
  subtitle_uppercase: z.boolean().nullable().describe("Solo se indicazioni, riferimento o richiesta lo chiedono, altrimenti null"),
  subtitles_enabled: z.boolean().nullable().describe("false solo se il cliente chiede esplicitamente niente sottotitoli, altrimenti null"),
  punch_in: z.boolean().nullable().describe("Zoom alternato sui tagli: solo se indicazioni, riferimento o richiesta lo chiedono, altrimenti null"),
  pause_trim: z.enum(["stretto", "medio", "morbido"]).nullable().describe("Quanto accorciare le pause: stretto = ritmo serrato. Solo se indicazioni, riferimento o richiesta lo chiedono, altrimenti null"),
  music_volume: z.enum(["bassa", "media", "alta"]).nullable().describe("Solo se indicazioni, riferimento o richiesta lo chiedono, altrimenti null"),
  broll: z
    .array(
      z.object({
        at_word: z.number().int().describe("Indice della parola su cui far partire la clip (la voce continua sotto)"),
        duration_s: z.number().describe("Durata della clip in secondi: 2-4 per lo stock, 2-6 per le clip del cliente"),
        own_clip: z
          .number()
          .int()
          .nullable()
          .describe("Numero della clip di copertura del cliente da usare (1, 2, ...), oppure null per una clip stock"),
        query_en: z.string().describe("Cosa mostrare, 2-4 parole in inglese, concreto (es. 'pizza oven fire')"),
      }),
    )
    .describe("Immagini di supporto nei punti in cui si parla di qualcosa che si può mostrare: prima le clip del cliente, poi lo stock"),
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
- La trascrizione è automatica e può contenere errori: parole capite male ("al compost" invece di "alcun post", "real" invece di "reel"), nomi storpiati, punteggiatura sbagliata. Ragiona su cosa è stato DETTO davvero, aiutandoti con lo script e con il senso della frase, sia per scegliere i tagli sia per i sottotitoli.
- subtitle_fixes: per ogni errore di trascrizione nelle parti che tieni, indica le parole (from_word..to_word, al massimo 12) e il testo corretto come va mostrato a schermo, con punteggiatura e maiuscole giuste. Correggi solo errori di trascrizione: non riscrivere, non abbellire, non cambiare ciò che è stato detto anche se diverso dallo script. Se la trascrizione è giusta, lista vuota.
- Scelta tra più prove della stessa frase: tieni la versione migliore (completa, senza inciampi, detta con più convinzione), di solito l'ultima. Se una prova ha una parola d'apertura forte che le altre non hanno (es. "Basta,"), valuta di tenerla.
- highlight_words: 1 parola chiave ogni 4-8 parole al massimo (numeri, promesse, nomi di prodotti). Mai parole vuote.
- hook_overlay: una scritta breve (max 6 parole) che rinforza l'apertura, oppure null se il video parla già da solo.
- music_mood: scegli in base al tono del brand e del contenuto; "nessuna" se la musica disturberebbe.
- broll: clip a schermo intero sopra la voce, nei punti in cui si parla di qualcosa di concreto da mostrare (un prodotto, un luogo, un'azione). Mai nei primi 3 secondi, mai mentre il titolare mostra lui stesso qualcosa.
  - Se ci sono CLIP DI COPERTURA DEL CLIENTE, usale per prime (own_clip = il loro numero): ognuna al massimo una volta, nel punto in cui si parla di ciò che mostrano (se non c'è descrizione, dove si parla dell'attività o del prodotto in generale), per non più della loro durata. Cerca di usarle tutte: le ha girate apposta.
  - Le clip stock (own_clip = null, con query_en) solo per i punti rimasti, rispettando il numero massimo di clip stock indicato.
- caption e hashtags: in italiano, coerenti con il brand e la città; niente promesse o dati non detti nel video.
- Priorità: 1) INDICAZIONI DEL CLIENTE per questo video e RICHIESTA DI MODIFICA, 2) STILE DI RIFERIMENTO (il video che il cliente ha indicato come esempio), 3) stile preferito del brand. Le indicazioni del cliente vanno seguite il più possibile; se chiedono qualcosa che il montaggio non sa fare (transizioni animate, effetti grafici, font particolari) avvicinati con ciò che è possibile e scrivilo nelle notes.
- subtitle_size, subtitle_style, subtitle_position, subtitle_uppercase, subtitles_enabled, punch_in, pause_trim, music_volume: impostali quando le indicazioni del cliente, lo stile di riferimento o la richiesta di modifica li riguardano; altrimenti null (vale lo stile del brand).
- Con uno stile di riferimento, imita anche ritmo e durata: con molti tagli al minuto tieni solo l'essenziale e pause strette; con uno stile calmo lascia respirare il discorso. Se il riferimento ha una scritta d'apertura, proponi hook_overlay; se non ce l'ha, null.

Le pause lunghe nella trascrizione sono segnate con ‖. Gli indici sono tra parentesi quadre.
Rispondi solo con il JSON richiesto.`;

/** Clip di copertura caricata dal cliente (b-roll proprio), numerata da 1. */
export interface CoverClip {
  n: number;
  description: string | null;
  durationS: number;
  storagePath: string;
}

export interface PlanContext {
  brand: { companyName: string; city: string | null; toneOfVoice: string | null; doNotSay: string | null; editStyle: EditStyle };
  script: { title: string; hook: string; body: string } | null;
  words: Word[];
  coverClips?: CoverClip[];
  /** Come il cliente vuole il montaggio di questo video (testo libero). */
  clientNotes?: string | null;
  /** Stile ricavato dai video di riferimento, già in forma di testo. */
  styleReference?: string | null;
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
    `STILE DI MONTAGGIO PREFERITO\n- Ritmo: ${style.pace ?? "medio"}\n- Musica: ${style.music?.mood ?? "energica"}\n- B-roll stock: massimo ${maxBroll(style)} clip`,
    ctx.script
      ? `SCRIPT DI RIFERIMENTO (il titolare può essersi discostato)\n- Titolo: ${ctx.script.title}\n- Apertura prevista: ${ctx.script.hook}\n- Testo: ${ctx.script.body.replace(/\n+/g, " ")}`
      : "SCRIPT DI RIFERIMENTO\n- Nessuno: video libero.",
    `TRASCRIZIONE (PAROLE TOTALI: ${ctx.words.length})\n${transcriptForPrompt(ctx.words)}`,
  ];
  if (ctx.styleReference) parts.splice(2, 0, ctx.styleReference);
  if (ctx.clientNotes?.trim()) {
    parts.splice(2, 0, `INDICAZIONI DEL CLIENTE PER QUESTO VIDEO (hanno la precedenza)\n${ctx.clientNotes.trim()}`);
  }
  if (ctx.coverClips?.length) {
    parts.splice(
      parts.findIndex((p) => p.startsWith("TRASCRIZIONE")),
      0,
      `CLIP DI COPERTURA DEL CLIENTE (senza parlato, da mettere sopra la voce)\n${ctx.coverClips
        .map((c) => `- Clip ${c.n} (${c.durationS.toFixed(1)} s): ${c.description?.trim() || "nessuna descrizione"}`)
        .join("\n")}`,
    );
  }
  if (ctx.previous) {
    parts.push(
      `MONTAGGIO PRECEDENTE\n${JSON.stringify({ keep: ctx.previous.plan.keep, hook_overlay: ctx.previous.plan.hook_overlay, music_mood: ctx.previous.plan.music_mood, subtitle_fixes: ctx.previous.plan.subtitle_fixes ?? [], subtitle_size: ctx.previous.plan.subtitle_size, subtitle_style: ctx.previous.plan.subtitle_style, subtitle_position: ctx.previous.plan.subtitle_position, subtitle_uppercase: ctx.previous.plan.subtitle_uppercase, punch_in: ctx.previous.plan.punch_in, pause_trim: ctx.previous.plan.pause_trim })}`,
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
    // Il montaggio è il prodotto: più ragionamento su tagli, prove ripetute e correzioni.
    effort: "high",
  });
  return { plan: res.data, cost: res.cost };
}

const MUSIC_VOLUME = { bassa: 0.07, media: 0.11, alta: 0.16 } as const;
/** Pausa massima tenuta dentro una frase (secondi). */
const PAUSE_TRIM = { stretto: 0.28, medio: 0.45, morbido: 0.75 } as const;

export type StyleDefaults = {
  subtitlesEnabled: boolean;
  subtitleSize: "piccoli" | "medi" | "grandi" | null;
  subtitleStyle: "pulito" | "evidenziato" | "karaoke" | null;
  subtitlePosition: "alto" | "centro" | "basso" | null;
  subtitleUppercase: boolean | null;
  punchIn: boolean;
  maxPause: number | null;
};

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
  coverClips?: CoverClip[];
  /** Valori ricavati dal video di riferimento (vincono le scelte esplicite dell'AI). */
  styleDefaults?: StyleDefaults | null;
}): EditSpec {
  const sd = args.styleDefaults ?? null;
  const prev = args.previousSpec ?? null;
  const { plan, words, source, editStyle } = args;
  const n = words.length;
  const ranges = plan.keep
    .map((r) => ({ from: Math.max(0, Math.min(n - 1, r.from_word)), to: Math.max(0, Math.min(n - 1, r.to_word)) }))
    .filter((r) => n > 0 && r.to >= r.from);

  const maxPause = plan.pause_trim ? PAUSE_TRIM[plan.pause_trim] : (sd?.maxPause ?? undefined);
  let segments = n > 0 && ranges.length ? segmentsFromWordRanges(words, ranges, source.durationS, maxPause) : [];
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
      enabled: plan.subtitles_enabled ?? prev?.subtitles.enabled ?? true,
      style: plan.subtitle_style ?? prev?.subtitles.style ?? sd?.subtitleStyle ?? editStyle.subtitles?.style ?? "evidenziato",
      size: plan.subtitle_size ?? prev?.subtitles.size ?? sd?.subtitleSize ?? editStyle.subtitles?.size ?? "medi",
      position: plan.subtitle_position ?? prev?.subtitles.position ?? sd?.subtitlePosition ?? "auto",
      uppercase: plan.subtitle_uppercase ?? prev?.subtitles.uppercase ?? sd?.subtitleUppercase ?? false,
      highlightWordIndices: plan.highlight_words.filter((i) => keptIdx.size === 0 || keptIdx.has(i)).slice(0, 40),
      highlightColor: args.brandColor && /^#[0-9a-f]{6}$/i.test(args.brandColor) ? args.brandColor : "#0A5CFF",
      font: "Inter",
      fixes: (plan.subtitle_fixes ?? [])
        .map((f) => ({ from: f.from_word, to: f.to_word, text: f.text.trim().slice(0, 120) }))
        .filter((f) => f.text && f.from >= 0 && f.to < n && f.to >= f.from),
    },
    music: track
      ? { trackId: track.id, volume: plan.music_volume ? MUSIC_VOLUME[plan.music_volume] : (prevVolume ?? MUSIC_VOLUME.media) }
      : null,
    hookOverlay: plan.hook_overlay?.trim() ? plan.hook_overlay.trim().slice(0, 60) : null,
    outroLogo: (editStyle.logo_outro ?? true) && args.hasLogo,
    punchIn: plan.punch_in ?? prev?.punchIn ?? sd?.punchIn ?? true,
    voiceCleanup: true,
    framing: defaultFraming(source),
    broll: placeBroll(plan, words, segments, maxBroll(editStyle), args.coverClips ?? []),
  };
  return EditSpecSchema.parse(spec);
}

/**
 * Dalle proposte del modello alle posizioni nel video montato, con regole fisse:
 * dopo la frase d'apertura (3 s), mai nell'ultimo secondo, almeno 1,5 s tra due clip.
 * Le clip di copertura del cliente (bucket "raw") vanno per prime, 2-6 s, ognuna una volta sola,
 * e non contano nel massimo di clip stock; quelle che il modello non ha collocato vanno
 * negli spazi liberi rimasti. Le clip stock durano 2-4 s.
 */
export function placeBroll(
  plan: EditPlan,
  words: Word[],
  segments: { start: number; end: number }[],
  max: number,
  coverClips: CoverClip[] = [],
) {
  const timed = remapWords(words, segments);
  const total = totalDuration(segments);
  const placed: EditSpec["broll"] = [];
  const fits = (at: number, duration: number) =>
    at >= 3 &&
    at + duration <= total - 1 &&
    placed.every((p) => at + duration + 1.5 <= p.at || at >= p.at + p.duration + 1.5);
  const byN = new Map(coverClips.map((c) => [c.n, c]));
  const usedClips = new Set<number>();
  const sorted = [...plan.broll].sort((a, b) => a.at_word - b.at_word);

  // 1. Clip del cliente dove le ha messe il modello
  for (const b of sorted) {
    const clip = b.own_clip != null ? byN.get(b.own_clip) : undefined;
    if (!clip || usedClips.has(clip.n)) continue;
    const w = timed.find((t) => t.index >= b.at_word);
    if (!w) continue;
    const duration = ownDuration(b.duration_s, clip.durationS);
    const at = Math.max(3, w.start);
    if (duration < 1 || !fits(at, duration)) continue;
    placed.push(ownEntry(at, duration, clip));
    usedClips.add(clip.n);
  }
  // 2. Clip del cliente rimaste: negli spazi liberi, distribuite lungo il video
  const left = coverClips.filter((c) => !usedClips.has(c.n));
  left.forEach((clip, i) => {
    const duration = ownDuration(3.5, clip.durationS);
    if (duration < 1) return;
    const ideal = 3 + ((total - 4) * (i + 1)) / (left.length + 1);
    for (const delta of [0, 1, -1, 2, -2, 3, -3, 4, -4, 6, -6]) {
      const at = Math.round((ideal + delta) * 100) / 100;
      if (fits(at, duration)) {
        placed.push(ownEntry(at, duration, clip));
        usedClips.add(clip.n);
        break;
      }
    }
  });
  // 3. Stock, nel limite dello stile scelto
  let stock = 0;
  const stockMax = Math.min(max, Math.floor(total / 8));
  for (const b of sorted) {
    if (b.own_clip != null && byN.has(b.own_clip)) continue;
    if (stock >= stockMax) break;
    const w = timed.find((t) => t.index >= b.at_word);
    if (!w || !b.query_en.trim()) continue;
    const duration = Math.min(4, Math.max(2, b.duration_s || 3));
    const at = Math.max(3, w.start);
    if (!fits(at, duration)) continue;
    placed.push({ at: Math.round(at * 100) / 100, duration, query: b.query_en.trim().slice(0, 60), storagePath: null, bucket: "output" });
    stock += 1;
  }
  return placed.sort((a, b) => a.at - b.at);
}

function ownDuration(requested: number, clipDuration: number) {
  return Math.round(Math.min(6, Math.max(2, requested || 3.5), clipDuration - 0.1) * 100) / 100;
}

function ownEntry(at: number, duration: number, clip: CoverClip): EditSpec["broll"][number] {
  return {
    at: Math.round(at * 100) / 100,
    duration,
    query: `clip ${clip.n}${clip.description ? `: ${clip.description}` : ""}`.slice(0, 60),
    storagePath: clip.storagePath,
    bucket: "raw",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Ordine delle riprese (più clip parlate)
// ─────────────────────────────────────────────────────────────────────────
export const ClipOrderSchema = z.object({
  order: z.array(z.number().int()).describe("Numeri delle riprese nell'ordine in cui vanno montate, tutte, una volta sola"),
  notes: z.string().describe("In una frase: perché questo ordine (per il team)"),
});

export const CLIP_ORDER_SYSTEM_PROMPT = `Sei il montatore di Nexora Studio. Il titolare di una piccola azienda ha girato un video in più riprese separate. Ricevi la trascrizione di ogni ripresa e, se c'è, lo script che doveva seguire. Decidi in che ordine montarle.

Regole:
- Se c'è uno script, segui il suo ordine: apertura, poi il corpo, poi la chiusura o l'invito all'azione.
- Senza script, scegli l'ordine più logico per un video social: prima l'aggancio, poi il contenuto, poi la chiusura ("seguici", "vieni a trovarci", saluti).
- Le riprese senza parole (vuote) mettile in fondo.
- Includi tutte le riprese, una volta sola. Se due riprese dicono la stessa cosa, mettile vicine: le ripetizioni le toglie il montaggio dopo.
Rispondi solo con il JSON richiesto.`;

export async function planClipOrder(
  llm: LLMProvider,
  ctx: { script: { title: string; hook: string; body: string } | null; clips: { n: number; text: string; durationS: number }[] },
): Promise<{ order: number[]; notes: string; cost: ProviderCost }> {
  const prompt = [
    ctx.script
      ? `SCRIPT\n- Titolo: ${ctx.script.title}\n- Apertura: ${ctx.script.hook}\n- Testo: ${ctx.script.body.replace(/\n+/g, " ")}`
      : "SCRIPT\n- Nessuno: video libero.",
    `RIPRESE (${ctx.clips.length})\n${ctx.clips
      .map((c) => `- Ripresa ${c.n} (${c.durationS.toFixed(1)} s): ${c.text.trim() || "(nessuna parola)"}`)
      .join("\n")}`,
  ].join("\n\n");
  const res = await llm.generateObject({
    system: CLIP_ORDER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    schema: ClipOrderSchema,
    effort: "low",
  });
  return { order: normalizeOrder(res.data.order, ctx.clips.map((c) => c.n)), notes: res.data.notes, cost: res.cost };
}

/** Tiene solo numeri validi, senza doppioni, e aggiunge in coda quelli dimenticati. */
export function normalizeOrder(order: number[], all: number[]) {
  const valid = new Set(all);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const n of order) {
    if (valid.has(n) && !seen.has(n)) {
      out.push(n);
      seen.add(n);
    }
  }
  for (const n of all) if (!seen.has(n)) out.push(n);
  return out;
}
