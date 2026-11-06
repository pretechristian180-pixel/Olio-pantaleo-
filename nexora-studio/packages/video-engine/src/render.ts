import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { EditSpec } from "./edit-spec.js";
import { execCommand, ffmpegThreads } from "./exec.js";
import { facesBetween } from "./faces.js";
import { mapFaceToOutput } from "./framing.js";
import { buildAss, OUT_H, OUT_W } from "./subtitles.js";
import { applySubtitleFixes, outputToSource, remapWords, totalDuration } from "./timeline.js";
import type { FaceSample, SourceInfo, Word } from "./types.js";

export const OUTRO_SECONDS = 1.6;
const FPS = 30;

export interface RenderInput {
  workDir: string;
  sourcePath: string;
  source: SourceInfo;
  words: Word[];
  faces: FaceSample[];
  spec: EditSpec;
  outputPath: string;
  musicPath?: string | null;
  logoPath?: string | null;
  /** Clip b-roll già scaricate, nello stesso ordine di spec.broll. */
  brollPaths?: (string | null)[];
  /** Colore di sfondo della chiusura con il logo. */
  outroColor?: string;
}

const f3 = (n: number) => n.toFixed(3);

/** Espressione select di FFmpeg che tiene solo i segmenti indicati. */
export function selectExpr(segments: { start: number; end: number }[]) {
  return segments.map((s) => `between(t,${f3(s.start)},${f3(s.end)})`).join("+");
}

/**
 * Costruisce gli argomenti di FFmpeg per il montaggio (separato dall'esecuzione per i test).
 * Passi: tagli → 9:16 → sottotitoli → b-roll → chiusura con logo; voce + musica con ducking,
 * normalizzazione del volume per i social (-14 LUFS).
 */
/** Metadati scritti in ogni video esportato. */
export const AI_METADATA: [string, string][] = [
  ["comment", "Video montato con intelligenza artificiale da Nexora Studio (AI-edited content)."],
  ["description", "AI-edited video: cuts, subtitles, music and stock footage selected by an AI system (Nexora Studio)."],
  ["encoder_info", "Nexora Studio"],
  ["ai_generated", "edited"],
  ["ai_system", "Nexora Studio"],
];

export function buildRenderArgs(input: RenderInput, assFile: string) {
  const { spec, source } = input;
  const segs = spec.segments;
  const mainDur = totalDuration(segs);
  const withOutro = spec.outroLogo && Boolean(input.logoPath);
  const total = mainDur + (withOutro ? OUTRO_SECONDS : 0);

  const threads = ffmpegThreads();
  const args: string[] = [
    "-y", "-v", "error", "-filter_complex_threads", threads, "-threads", threads, "-i", input.sourcePath,
  ];
  let idx = 1;
  const musicIdx = input.musicPath && spec.music ? idx++ : null;
  if (musicIdx !== null) args.push("-stream_loop", "-1", "-i", input.musicPath!);
  const logoIdx = withOutro ? idx++ : null;
  if (logoIdx !== null) args.push("-i", input.logoPath!);
  const brollIdx: (number | null)[] = (input.brollPaths ?? []).map((p) => {
    if (!p) return null;
    args.push("-i", p);
    return idx++;
  });

  const f: string[] = [];
  const sel = selectExpr(segs);

  // Video: frame rate costante, tagli, formato 9:16
  f.push(`[0:v]fps=${FPS},select='${sel}',setpts=N/${FPS}/TB[vcut]`);
  if (spec.framing === "cover") {
    f.push(`[vcut]scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,crop=${OUT_W}:${OUT_H},setsar=1[vframe]`);
  } else {
    f.push(`[vcut]split[vbg0][vfg0]`);
    f.push(`[vbg0]scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,crop=${OUT_W}:${OUT_H},boxblur=40:2,eq=brightness=-0.1[vbg]`);
    f.push(`[vfg0]scale=${OUT_W}:-2[vfg]`);
    f.push(`[vbg][vfg]overlay=(W-w)/2:(H-h)/2,setsar=1[vframe]`);
  }

  // Zoom alternato sui tagli: un segmento sì e uno no (se dura almeno 1,2 s) l'inquadratura
  // stringe del 10%, centrata un po' in alto dove di solito c'è il viso. Nasconde il salto del taglio.
  let vLabel = "vframe";
  const zoomed = spec.punchIn && spec.framing === "cover" ? zoomWindows(segs) : [];
  if (zoomed.length) {
    const zw = Math.round((OUT_W * 1.1) / 2) * 2;
    const zh = Math.round((OUT_H * 1.1) / 2) * 2;
    f.push(`[vframe]split[vz0][vz1]`);
    f.push(`[vz1]scale=${zw}:${zh},crop=${OUT_W}:${OUT_H}:${(zw - OUT_W) / 2}:${Math.round((zh - OUT_H) * 0.35)}[vzin]`);
    f.push(`[vz0][vzin]overlay=0:0:enable='${zoomed.map((z) => `between(t,${f3(z.start)},${f3(z.end)})`).join("+")}'[vzoom]`);
    vLabel = "vzoom";
  }

  // B-roll: clip a schermo intero negli intervalli indicati (la voce continua sotto)
  spec.broll.forEach((b, i) => {
    const bi = brollIdx[i];
    if (bi === null || bi === undefined) return;
    f.push(
      `[${bi}:v]trim=0:${f3(b.duration)},setpts=PTS-STARTPTS+${f3(b.at)}/TB,fps=${FPS},scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,crop=${OUT_W}:${OUT_H},setsar=1[br${i}]`,
    );
    f.push(`[${vLabel}][br${i}]overlay=0:0:eof_action=pass:enable='between(t,${f3(b.at)},${f3(b.at + b.duration)})'[vb${i}]`);
    vLabel = `vb${i}`;
  });

  // Sottotitoli (sopra il b-roll, così restano leggibili)
  f.push(`[${vLabel}]ass=${assFile}[vsub]`);

  // Audio voce: stessi tagli, micro-dissolvenze per evitare "click" ai tagli
  if (source.hasAudio) {
    // Voce: rumore e rimbombo ridotti (telefono), poi i tagli con micro-dissolvenze anti "click".
    const clean = spec.voiceCleanup ? "highpass=f=80,afftdn=nf=-28:tn=1," : "";
    f.push(`[0:a]${clean}aselect='${sel}',asetpts=N/SR/TB,aresample=48000,afade=t=in:d=0.03[voice]`);
  } else {
    f.push(`anullsrc=r=48000:cl=stereo,atrim=0:${f3(mainDur)}[voice]`);
  }

  // Chiusura con logo + silenzio
  let vOut = "vsub";
  let aMain = "voice";
  if (logoIdx !== null) {
    const bg = (input.outroColor ?? "#05070d").replace("#", "0x");
    f.push(`color=c=${bg}:s=${OUT_W}x${OUT_H}:d=${OUTRO_SECONDS}:r=${FPS}[obg]`);
    f.push(`[${logoIdx}:v]scale=520:-1,format=rgba[ologo]`);
    f.push(`[obg][ologo]overlay=(W-w)/2:(H-h)/2,fade=t=in:st=0:d=0.35,setsar=1[outro]`);
    f.push(`anullsrc=r=48000:cl=stereo,atrim=0:${OUTRO_SECONDS}[osil]`);
    f.push(`[vsub][voice][outro][osil]concat=n=2:v=1:a=1[vcat][acat]`);
    vOut = "vcat";
    aMain = "acat";
  }

  // Musica sotto la voce, con abbassamento automatico quando si parla (ducking)
  if (musicIdx !== null && spec.music) {
    const vol = Math.min(0.4, Math.max(0.02, spec.music.volume));
    f.push(`[${aMain}]asplit[vo1][vo2]`);
    f.push(
      `[${musicIdx}:a]aresample=48000,atrim=0:${f3(total)},volume=${vol.toFixed(3)},afade=t=in:d=0.8,afade=t=out:st=${f3(Math.max(0, total - 1.5))}:d=1.5[mus]`,
    );
    f.push(`[mus][vo2]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=350[mduck]`);
    f.push(`[vo1][mduck]amix=inputs=2:duration=first:normalize=0[amix]`);
    aMain = "amix";
  }
  f.push(`[${aMain}]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`);

  args.push(
    "-filter_complex", f.join(";"),
    "-map", `[${vOut}]`, "-map", "[aout]",
    "-threads", threads,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
    // Marcatura leggibile dalle macchine dei contenuti montati con AI (AI Act, art. 50):
    // metadati MP4 standard (comment, description) e chiavi dedicate.
    ...AI_METADATA.flatMap(([k, v]) => ["-metadata", `${k}=${v}`]),
    "-movflags", "+faststart+use_metadata_tags",
    "-t", f3(total),
    input.outputPath,
  );
  return { args, durationS: total };
}

/** Intervalli (tempo del video montato) con lo zoom: i segmenti dispari lunghi almeno 1,2 s. */
export function zoomWindows(segments: { start: number; end: number }[]) {
  const out: { start: number; end: number }[] = [];
  let t = 0;
  segments.forEach((s, i) => {
    const d = s.end - s.start;
    if (i % 2 === 1 && d >= 1.2) out.push({ start: t, end: t + d });
    t += d;
  });
  return out;
}

/** Prepara i sottotitoli (evitando i volti) ed esegue FFmpeg. */
export async function renderVideo(input: RenderInput) {
  const { spec, source } = input;
  const segs = spec.segments;
  // Testo corretto per i sottotitoli (errori di trascrizione), tempi dell'audio.
  const words = remapWords(applySubtitleFixes(input.words, spec.subtitles.fixes), segs).filter((w) => w.text);

  const facesAt = (start: number, end: number) => {
    const s = outputToSource(start, segs);
    const e = outputToSource(end, segs);
    return facesBetween(input.faces, s, e)
      .map((box) => mapFaceToOutput(box, source, spec.framing))
      .filter((b): b is NonNullable<typeof b> => b !== null);
  };

  const hookUntil = spec.hookOverlay ? Math.min(3, totalDuration(segs)) : undefined;
  const ass = buildAss({ words, spec, facesAt, hookUntil });
  await writeFile(join(input.workDir, "subs.ass"), ass, "utf8");

  const { args, durationS } = buildRenderArgs(input, "subs.ass");
  const started = Date.now();
  await execCommand("ffmpeg", args, { cwd: input.workDir, timeoutMs: 30 * 60_000 });
  return { durationS, renderMs: Date.now() - started };
}

/** Copertina: un fotogramma del video montato (dopo la frase d'apertura). */
export async function extractThumbnail(videoPath: string, outPath: string, atS = 1.2) {
  await execCommand("ffmpeg", [
    "-y", "-v", "error", "-ss", atS.toFixed(2), "-i", videoPath, "-frames:v", "1", "-q:v", "3", outPath,
  ], { timeoutMs: 60_000 });
}

/** Audio leggero per la trascrizione (mono 16 kHz, ~1 MB ogni 4 minuti). */
export async function extractAudioForTranscription(videoPath: string, outPath: string) {
  await execCommand("ffmpeg", [
    "-y", "-v", "error", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", outPath,
  ], { timeoutMs: 10 * 60_000 });
}
