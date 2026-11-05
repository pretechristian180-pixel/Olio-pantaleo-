/** Estrae fino a `max` colori dominanti da un'immagine (logo), lato browser. */
export async function extractColors(file: Blob, max = 4): Promise<string[]> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map<string, { r: number; g: number; b: number; n: number; sat: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a < 200) continue;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      // Scarta lo sfondo quasi bianco o quasi nero.
      if (maxC > 245 && minC > 235) continue;
      if (maxC < 14) continue;
      const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, sat: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
      bucket.sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      buckets.set(key, bucket);
    }

    // Prima i colori saturi (il "colore del brand"), poi i neutri.
    const ranked = [...buckets.values()]
      .map((b) => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, score: b.n * (0.35 + b.sat) }))
      .sort((a, b) => b.score - a.score);

    const picked: { r: number; g: number; b: number }[] = [];
    for (const c of ranked) {
      if (picked.every((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) > 60)) picked.push(c);
      if (picked.length >= max) break;
    }
    return picked.map(toHex);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
