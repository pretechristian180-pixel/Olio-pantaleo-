import { readFile, rm } from "node:fs/promises";

import { execCommand } from "./exec.js";
import type { Segment } from "./types.js";

/** Passo dell'inviluppo del volume (secondi). */
export const ENVELOPE_HOP = 0.01;

/**
 * Volume della voce nel tempo (dB RMS ogni 10 ms), dal file audio/video.
 * Serve a mettere i tagli nei silenzi veri: i tempi delle parole di Whisper sono stime.
 */
export async function loudnessEnvelope(path: string, tmpFile = `${path}.pcm`): Promise<Float32Array> {
  const rate = 8000;
  await execCommand("ffmpeg", ["-y", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", String(rate), "-f", "s16le", tmpFile], {
    timeoutMs: 5 * 60_000,
  });
  try {
    const buf = await readFile(tmpFile);
    const samples = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2));
    const hop = Math.round(rate * ENVELOPE_HOP);
    const env = new Float32Array(Math.ceil(samples.length / hop));
    for (let i = 0; i < env.length; i++) {
      let sum = 0;
      const end = Math.min(samples.length, (i + 1) * hop);
      for (let j = i * hop; j < end; j++) sum += samples[j]! * samples[j]!;
      const rms = Math.sqrt(sum / Math.max(1, end - i * hop)) / 32768;
      env[i] = 20 * Math.log10(rms + 1e-6);
    }
    return env;
  } finally {
    await rm(tmpFile, { force: true });
  }
}

/** Indice del minimo in [a, b] (frame); a parità entro `tol` dB vince quello più vicino a `prefer`. */
function quietest(env: Float32Array, a: number, b: number, prefer: number, tol = 3) {
  const lo = Math.max(0, a);
  const hi = Math.min(env.length - 1, b);
  if (hi < lo) return null;
  let min = Infinity;
  for (let i = lo; i <= hi; i++) min = Math.min(min, env[i]!);
  let best = -1;
  for (let i = lo; i <= hi; i++) {
    if (env[i]! <= min + tol && (best < 0 || Math.abs(i - prefer) < Math.abs(best - prefer))) best = i;
  }
  return best < 0 ? null : best;
}

/**
 * Sposta inizio e fine di ogni segmento nel punto più silenzioso vicino: l'inizio può anticipare
 * fino a 0,25 s (mai tagliare l'attacco di una parola), la fine può ritardare fino a 0,3 s (mai
 * mangiare l'ultima sillaba). Tra due punti ugualmente silenziosi sceglie quello più vicino al parlato.
 */
export function snapSegmentsToSilence(segments: Segment[], env: Float32Array, durationS: number): Segment[] {
  if (!env.length) return segments;
  const f = (t: number) => Math.round(t / ENVELOPE_HOP);
  const t = (i: number) => Math.round(i * ENVELOPE_HOP * 1000) / 1000;
  const out = segments.map((s) => {
    const startIdx = quietest(env, f(s.start - 0.25), f(s.start + 0.04), f(s.start + 0.04));
    const endIdx = quietest(env, f(s.end - 0.04), f(s.end + 0.3), f(s.end - 0.04));
    const start = startIdx === null ? s.start : Math.min(s.start + 0.04, t(startIdx));
    const end = endIdx === null ? s.end : Math.max(s.end - 0.04, t(endIdx));
    return { start: Math.max(0, start), end: Math.min(durationS, end) };
  });
  // Segmenti consecutivi non devono sovrapporsi dopo lo spostamento.
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]!;
    const cur = out[i]!;
    if (cur.start > prev.start && cur.start < prev.end) {
      const mid = (cur.start + prev.end) / 2;
      prev.end = mid;
      cur.start = mid;
    }
  }
  return out.filter((s) => s.end - s.start > 0.15);
}
