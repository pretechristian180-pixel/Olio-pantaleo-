import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import type { LLMContentPart, LLMProvider, ProviderCost } from "@nexora/shared/server";
import { execCommand, loudnessEnvelope, probeVideo } from "@nexora/video-engine";
import { z } from "zod";

const execFfmpeg = (args: string[]) => execCommand("ffmpeg", args, { timeoutMs: 5 * 60_000 });

/** Quello che l'AI vede nei fotogrammi del video di riferimento. */
export const VisualStyleSchema = z.object({
  subtitles: z.object({
    present: z.boolean(),
    position: z.enum(["alto", "centro", "basso"]).nullable(),
    size: z.enum(["piccoli", "medi", "grandi"]).nullable(),
    uppercase: z.boolean().nullable(),
    highlight: z.enum(["nessuno", "parola colorata", "karaoke"]).nullable().describe("Come viene evidenziata la parola"),
    words_per_block: z.number().int().nullable().describe("Parole a schermo per volta, circa"),
  }),
  keyword_emphasis: z.boolean().describe("Parole chiave ripetute in grande (oltre al sottotitolo normale), anche con effetti luminosi"),
  logo: z.enum(["nessuno", "alto", "alto-sinistra", "alto-destra", "altro"]).describe("Logo del marchio fisso a schermo e dove"),
  hook_text: z.boolean().describe("C'è una scritta grande d'apertura nei primi secondi"),
  text_overlays: z.boolean().describe("Ci sono titoli o scritte oltre ai sottotitoli"),
  zoom: z.enum(["nessuno", "leggero", "frequente"]).describe("Zoom o cambi di inquadratura sul parlato"),
  broll: z.enum(["nessuno", "poco", "spesso"]).describe("Immagini di copertura sopra la voce"),
  framing: z.enum(["primo piano", "mezzo busto", "figura intera", "altro"]),
  energy: z.enum(["calmo", "medio", "energico"]),
  description: z.string().describe("In 2-3 frasi, in italiano: cosa rende riconoscibile lo stile di questo video"),
});
export type VisualStyle = z.infer<typeof VisualStyleSchema>;

/** Profilo completo: misure dal file + stile visivo. Salvato in style_profiles. */
export interface StyleProfile {
  version: 1;
  durationS: number;
  cutsPerMinute: number;
  avgShotS: number;
  /** Audio di sottofondo continuo (musica) anche nelle pause del parlato. */
  backgroundAudio: boolean;
  visual: VisualStyle;
}

export const STYLE_SYSTEM_PROMPT = `Sei il montatore di Christian Prete Studio. Ti mostro alcuni fotogrammi presi a intervalli regolari da un video social verticale che un cliente ha scelto come riferimento di stile, insieme ad alcune misure. Descrivi lo stile di montaggio in modo che si possa riprodurre: sottotitoli (presenza, zona dello schermo, dimensione, maiuscole, evidenziazione), scritte d'apertura, titoli, zoom, immagini di copertura, inquadratura, energia.
Descrivi solo ciò che vedi; se un aspetto non si capisce dai fotogrammi, usa null. Non descrivere il contenuto o la persona, solo lo stile.
Rispondi solo con il JSON richiesto.`;

/** Fotogrammi distribuiti sul video (il primo a 0,5 s per vedere l'apertura), 480 px di larghezza. */
async function sampleFrames(path: string, durationS: number, dir: string, count = 8) {
  await mkdir(dir, { recursive: true });
  const times = [0.5, ...Array.from({ length: count - 1 }, (_, i) => ((i + 1) * durationS) / count)].filter(
    (t) => t < durationS,
  );
  for (const [i, t] of times.entries()) {
    await execFfmpeg(["-y", "-v", "error", "-ss", t.toFixed(2), "-i", path, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "5", join(dir, `f${String(i).padStart(2, "0")}.jpg`)]);
  }
  const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
  return Promise.all(files.map(async (f) => (await readFile(join(dir, f))).toString("base64")));
}

/** Cambi d'inquadratura (tagli) rilevati da FFmpeg. */
async function countCuts(path: string, dir: string) {
  const out = join(dir, "scene.txt");
  await execFfmpeg(["-y", "-v", "error", "-i", path, "-an", "-vf", `scale=320:-2,select='gt(scene,0.32)',metadata=print:file=${out}`, "-f", "null", "-"]);
  const text = await readFile(out, "utf8").catch(() => "");
  return (text.match(/pts_time:/g) ?? []).length;
}

/**
 * Analizza un video di riferimento: ritmo dei tagli e sottofondo (FFmpeg), stile visivo (Claude
 * guarda i fotogrammi). Una chiamata all'AI per file; il risultato va salvato e riusato.
 */
export async function analyzeStyle(llm: LLMProvider, path: string, workDir: string): Promise<{ profile: StyleProfile; cost: ProviderCost }> {
  const dir = join(workDir, "frames");
  try {
    const info = await probeVideo(path);
    const durationS = Math.max(1, info.durationS);
    const cuts = await countCuts(path, workDir);
    let backgroundAudio = false;
    if (info.hasAudio) {
      const env = await loudnessEnvelope(path, join(workDir, "ref.pcm"));
      const sorted = [...env].sort((a, b) => a - b);
      // Nelle pause del parlato c'è ancora suono: musica o sottofondo continuo.
      backgroundAudio = (sorted[Math.floor(sorted.length * 0.1)] ?? -120) > -42;
    }
    const cutsPerMinute = Math.round((cuts / durationS) * 60 * 10) / 10;
    const avgShotS = Math.round((durationS / (cuts + 1)) * 10) / 10;
    const frames = await sampleFrames(path, durationS, dir);

    const content: LLMContentPart[] = [
      {
        type: "text",
        text: `ANALISI DELLO STILE DI RIFERIMENTO\n- Durata: ${durationS.toFixed(0)} s\n- Tagli/cambi di inquadratura: ${cuts} (${cutsPerMinute} al minuto, inquadratura media ${avgShotS} s)\n- Sottofondo musicale continuo: ${backgroundAudio ? "probabile" : "no"}\nFotogrammi in ordine di tempo (il primo a 0,5 s):`,
      },
      ...frames.map((data) => ({ type: "image" as const, mediaType: "image/jpeg" as const, data })),
    ];
    const res = await llm.generateObject({
      system: STYLE_SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      schema: VisualStyleSchema,
      effort: "low",
      maxTokens: 2000,
    });
    return {
      profile: { version: 1, durationS: Math.round(durationS * 10) / 10, cutsPerMinute, avgShotS, backgroundAudio, visual: res.data },
      cost: res.cost,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Testo per il prompt del montaggio. */
export function styleForPrompt(p: StyleProfile, label: string) {
  const v = p.visual;
  const sub = v.subtitles.present
    ? `sottotitoli ${[v.subtitles.size, v.subtitles.position ? `in ${v.subtitles.position}` : null, v.subtitles.uppercase ? "in maiuscolo" : null, v.subtitles.highlight ? `evidenziazione: ${v.subtitles.highlight}` : null, v.subtitles.words_per_block ? `~${v.subtitles.words_per_block} parole per volta` : null].filter(Boolean).join(", ")}`
    : "senza sottotitoli";
  return [
    `${label}`,
    `- Ritmo: ${p.cutsPerMinute} tagli al minuto (inquadratura media ${p.avgShotS} s), energia ${v.energy}`,
    `- ${sub}`,
    `- Scritta d'apertura: ${v.hook_text ? "sì" : "no"}; altri titoli a schermo: ${v.text_overlays ? "sì" : "no"}`,
    `- Zoom: ${v.zoom}; immagini di copertura: ${v.broll}; inquadratura: ${v.framing}`,
    `- Parole chiave ripetute in grande: ${v.keyword_emphasis ? "sì" : "no"}; logo fisso: ${v.logo ?? "nessuno"}`,
    `- Musica di sottofondo: ${p.backgroundAudio ? "sì" : "no"}`,
    `- In breve: ${v.description}`,
  ].join("\n");
}

/** Impostazioni predefinite ricavate dal riferimento (le indicazioni scritte del cliente vincono). */
export function styleDefaults(p: StyleProfile) {
  const v = p.visual;
  const st = v.subtitles;
  return {
    subtitlesEnabled: st.present,
    subtitleSize: st.size ?? null,
    subtitleStyle: st.highlight === "karaoke" ? "karaoke" : st.highlight === "parola colorata" ? "evidenziato" : st.highlight === "nessuno" ? "pulito" : null,
    subtitlePosition: st.position ?? null,
    subtitleUppercase: st.uppercase ?? null,
    punchIn: v.zoom !== "nessuno",
    // Molti tagli al minuto = pause tagliate strette; montaggio calmo = pause più morbide.
    // I profili salvati prima di questi campi non li hanno: null = decide l'AI dalla descrizione.
    keywordEmphasis: v.keyword_emphasis ?? null,
    logoWatermark: v.logo === undefined ? null : v.logo === "altro" ? "alto-destra" : v.logo,
    maxPause: p.cutsPerMinute >= 18 || v.energy === "energico" ? 0.3 : v.energy === "calmo" && p.cutsPerMinute < 8 ? 0.7 : null,
  } as const;
}
