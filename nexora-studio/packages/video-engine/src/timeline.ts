import type { Segment, Word } from "./types.js";

export const PAD_BEFORE = 0.08;
export const PAD_AFTER = 0.18;
/** Pause più lunghe di così dentro un discorso vengono accorciate. */
export const MAX_PAUSE = 0.45;

/** Ordina, limita alla durata e unisce segmenti sovrapposti o quasi contigui. */
export function normalizeSegments(segments: Segment[], durationS: number, mergeGap = 0.12): Segment[] {
  const sorted = segments
    .map((s) => ({ start: Math.max(0, s.start), end: Math.min(durationS, s.end) }))
    .filter((s) => s.end - s.start > 0.05)
    .sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end + mergeGap) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

/**
 * Da intervalli di parole da tenere (indici inclusivi) a segmenti di tempo, togliendo le pause
 * lunghe dentro ogni intervallo. È la parte "tagli dei silenzi" del montaggio.
 */
export function segmentsFromWordRanges(
  words: Word[],
  ranges: { from: number; to: number }[],
  durationS: number,
): Segment[] {
  const segs: Segment[] = [];
  for (const r of ranges) {
    const from = Math.max(0, Math.min(r.from, r.to));
    const to = Math.min(words.length - 1, Math.max(r.from, r.to));
    let cur: Segment | null = null;
    for (let i = from; i <= to; i++) {
      const w = words[i]!;
      if (!cur) {
        cur = { start: w.start - PAD_BEFORE, end: w.end + PAD_AFTER };
        continue;
      }
      const gap = w.start - words[i - 1]!.end;
      if (gap > MAX_PAUSE) {
        segs.push(cur);
        cur = { start: w.start - PAD_BEFORE, end: w.end + PAD_AFTER };
      } else {
        cur.end = w.end + PAD_AFTER;
      }
    }
    if (cur) segs.push(cur);
  }
  return normalizeSegments(segs, durationS);
}

/** Durata totale del montaggio. */
export function totalDuration(segments: Segment[]) {
  return segments.reduce((acc, s) => acc + (s.end - s.start), 0);
}

/** Converte un tempo del girato nel tempo del video montato (null se tagliato via). */
export function sourceToOutput(t: number, segments: Segment[]): number | null {
  let offset = 0;
  for (const s of segments) {
    if (t >= s.start && t <= s.end) return offset + (t - s.start);
    offset += s.end - s.start;
  }
  return null;
}

/** Converte un tempo del video montato nel tempo del girato. */
export function outputToSource(t: number, segments: Segment[]): number {
  let offset = 0;
  for (const s of segments) {
    const len = s.end - s.start;
    if (t <= offset + len) return s.start + (t - offset);
    offset += len;
  }
  const last = segments[segments.length - 1];
  return last ? last.end : 0;
}

/** Parole che restano nel montaggio, con i tempi del video montato. */
export function remapWords(words: Word[], segments: Segment[]) {
  const out: (Word & { index: number })[] = [];
  words.forEach((w, index) => {
    const mid = (w.start + w.end) / 2;
    const start = sourceToOutput(Math.max(w.start, segmentFor(mid, segments)?.start ?? w.start), segments);
    const end = sourceToOutput(Math.min(w.end, segmentFor(mid, segments)?.end ?? w.end), segments);
    if (start !== null && end !== null) out.push({ text: w.text, start, end, index });
  });
  return out;
}

function segmentFor(t: number, segments: Segment[]) {
  return segments.find((s) => t >= s.start && t <= s.end);
}

/** Taglio automatico di base: tiene tutte le parole e accorcia le pause lunghe. */
export function silenceCut(words: Word[], durationS: number): Segment[] {
  if (words.length === 0) return [{ start: 0, end: durationS }];
  return segmentsFromWordRanges(words, [{ from: 0, to: words.length - 1 }], durationS);
}
