import { OUT_H, OUT_W } from "./subtitles.js";
import type { FaceBox, SourceInfo } from "./types.js";

/**
 * Converte un box del girato (normalizzato) nel frame 9:16 del video montato,
 * secondo l'inquadratura: "cover" (scala e taglia) o "fit" (video intero su sfondo sfocato).
 */
export function mapFaceToOutput(f: FaceBox, src: Pick<SourceInfo, "width" | "height">, framing: "cover" | "fit"): FaceBox | null {
  const sx = src.width;
  const sy = src.height;
  const scale = framing === "cover" ? Math.max(OUT_W / sx, OUT_H / sy) : OUT_W / sx;
  const w = sx * scale;
  const h = sy * scale;
  const offX = (OUT_W - w) / 2;
  const offY = (OUT_H - h) / 2;
  const x0 = (f.x * w + offX) / OUT_W;
  const y0 = (f.y * h + offY) / OUT_H;
  const out = { x: x0, y: y0, w: (f.w * w) / OUT_W, h: (f.h * h) / OUT_H };
  if (out.x + out.w < 0 || out.x > 1 || out.y + out.h < 0 || out.y > 1) return null;
  return out;
}

/** Inquadratura consigliata: verticale → riempi; orizzontale o quadrato → sfondo sfocato. */
export function defaultFraming(src: Pick<SourceInfo, "orientation">): "cover" | "fit" {
  return src.orientation === "portrait" ? "cover" : "fit";
}
