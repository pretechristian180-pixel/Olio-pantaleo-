import type { EditSpec } from "./edit-spec.js";
import type { FaceBox } from "./types.js";

export const OUT_W = 1080;
export const OUT_H = 1920;

export interface TimedWord {
  text: string;
  start: number;
  end: number;
  index: number;
}

export interface Chunk {
  words: TimedWord[];
  start: number;
  end: number;
}

const FONT_SIZE = { piccoli: 60, medi: 76, grandi: 94 } as const;
const MAX_WORDS = { piccoli: 4, medi: 3, grandi: 2 } as const;
const MAX_CHARS = { piccoli: 24, medi: 18, grandi: 14 } as const;

/** Raggruppa le parole in blocchi brevi e leggibili da telefono. */
export function chunkWords(words: TimedWord[], size: keyof typeof FONT_SIZE = "medi"): Chunk[] {
  const chunks: Chunk[] = [];
  let cur: TimedWord[] = [];
  const flush = () => {
    if (cur.length) chunks.push({ words: cur, start: cur[0]!.start, end: cur[cur.length - 1]!.end });
    cur = [];
  };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const text = [...cur, w].map((x) => x.text).join(" ");
    const tooLong = cur.length >= MAX_WORDS[size] || text.length > MAX_CHARS[size];
    const pause = prev ? w.start - prev.end > 0.35 : false;
    const tooSlow = cur.length ? w.end - cur[0]!.start > 2.2 : false;
    if (cur.length && (tooLong || pause || tooSlow)) flush();
    cur.push(w);
    if (/[.!?…;:]$/.test(w.text)) flush();
  }
  flush();
  // Ogni blocco resta a schermo fino al successivo (niente sfarfallio nelle micro-pause).
  for (let i = 0; i < chunks.length - 1; i++) {
    const gap = chunks[i + 1]!.start - chunks[i]!.end;
    if (gap > 0 && gap < 0.6) chunks[i]!.end = chunks[i + 1]!.start;
  }
  return chunks;
}

/** Posizioni verticali candidate (centro del testo), in ordine di preferenza. */
export const CANDIDATE_Y = [0.72, 0.84, 0.3, 0.16] as const;
/** Candidati per zona preferita (se la zona è occupata da un volto si passa alla successiva). */
export const POSITION_CANDIDATES = {
  auto: CANDIDATE_Y,
  alto: [0.22, 0.3, 0.72, 0.84],
  centro: [0.55, 0.64, 0.72, 0.3],
  basso: [0.8, 0.72, 0.88, 0.3],
} as const;
/** Per la frase d'apertura: in alto se libero, altrimenti al centro o in basso. */
export const HOOK_CANDIDATE_Y = [0.13, 0.5, 0.9] as const;

function intersects(a: { top: number; bottom: number }, f: FaceBox, margin = 0.03) {
  return a.top < f.y + f.h + margin && a.bottom > f.y - margin;
}

/**
 * Sceglie dove mettere un blocco di sottotitoli senza coprire i volti presenti in quel momento.
 * `faces` sono box normalizzati nel frame del video montato (1080x1920).
 */
export function chooseY(
  faces: FaceBox[],
  fontSize: number,
  lines = 1,
  candidates: readonly number[] = CANDIDATE_Y,
): number {
  const halfH = ((fontSize * 1.35 * lines) / OUT_H) / 2 + 0.015;
  for (const y of candidates) {
    const box = { top: y - halfH, bottom: y + halfH };
    if (!faces.some((f) => intersects(box, f))) return y;
  }
  // Nessuna posizione libera (volto enorme): il punto più lontano dal centro dei volti.
  const centers = faces.map((f) => f.y + f.h / 2);
  const avg = centers.reduce((a, b) => a + b, 0) / Math.max(1, centers.length);
  return avg < 0.5 ? 0.86 : 0.14;
}

/** Colore #RRGGBB → colore ASS &H00BBGGRR. */
export function assColor(hex: string, alpha = 0) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex) ?? ["", "0a", "5c", "ff"];
  const a = alpha.toString(16).padStart(2, "0").toUpperCase();
  return `&H${a}${m[3]!.toUpperCase()}${m[2]!.toUpperCase()}${m[1]!.toUpperCase()}`;
}

function assTime(t: number) {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

function escapeAss(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/[{}]/g, "").replace(/\n/g, " ");
}

/**
 * Genera il file .ass dei sottotitoli animati (stile del brand, posizione che evita i volti).
 * `facesAt(start, end)` restituisce i volti visibili in quell'intervallo del video montato.
 */
export function buildAss(args: {
  words: TimedWord[];
  spec: EditSpec;
  facesAt: (start: number, end: number) => FaceBox[];
  hookUntil?: number;
}): string {
  const { spec } = args;
  const st = spec.subtitles;
  const fs = FONT_SIZE[st.size];
  const highlight = new Set(st.highlightWordIndices);
  const white = "&H00FFFFFF";
  const brand = assColor(st.highlightColor);
  const outline = "&H00000000";
  const shadow = "&H80000000";

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${OUT_W}
PlayResY: ${OUT_H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,${st.font},${fs},${st.style === "karaoke" ? brand : white},${white},${outline},${shadow},-1,0,0,0,100,100,0,0,1,${Math.round(fs / 14)},2,5,60,60,0,1
Style: Hook,${st.font},${Math.round(fs * 0.9)},${white},${white},&H00000000,&H99000000,-1,0,0,0,100,100,0,0,3,18,0,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines: string[] = [];

  if (spec.hookOverlay && args.hookUntil) {
    const hookFs = Math.round(fs * 0.9);
    // Box con sfondo: altezza ~ testo + bordo; due righe se la frase è lunga.
    const hookLines = spec.hookOverlay.length > 26 ? 2 : 1;
    const y = Math.round(
      chooseY(args.facesAt(0, args.hookUntil), hookFs + 36, hookLines, HOOK_CANDIDATE_Y) * OUT_H,
    );
    lines.push(
      `Dialogue: 1,${assTime(0)},${assTime(args.hookUntil)},Hook,,0,0,0,,{\\an5\\pos(${OUT_W / 2},${y})\\fad(120,200)}${escapeAss(spec.hookOverlay)}`,
    );
  }

  if (st.enabled) {
    for (const c of chunkWords(args.words, st.size)) {
      const y = Math.round(
        chooseY(args.facesAt(c.start, c.end), fs, 1, POSITION_CANDIDATES[st.position]) * OUT_H,
      );
      const show = (t: string) => escapeAss(st.uppercase ? t.toLocaleUpperCase("it-IT") : t);
      const pop = `{\\an5\\pos(${OUT_W / 2},${y})\\fscx88\\fscy88\\t(0,110,\\fscx100\\fscy100)\\fad(40,30)}`;
      let text: string;
      if (st.style === "karaoke") {
        text = c.words
          .map((w) => `{\\kf${Math.max(1, Math.round((w.end - w.start) * 100))}}${show(w.text)}`)
          .join(" ");
      } else {
        text = c.words
          .map((w) =>
            st.style === "evidenziato" && highlight.has(w.index)
              ? `{\\c${brand}}${show(w.text)}{\\c${white}}`
              : show(w.text),
          )
          .join(" ");
      }
      lines.push(`Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Sub,,0,0,0,,${pop}${text}`);
    }
  }
  return header + lines.join("\n") + "\n";
}
