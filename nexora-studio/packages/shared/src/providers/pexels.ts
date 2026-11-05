import type { BrollClip, BrollProvider, BrollRequest } from "./broll.js";

interface PexelsVideoFile {
  id: number;
  quality: string | null;
  file_type: string;
  width: number | null;
  height: number | null;
  link: string;
}
interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

/**
 * B-roll stock da Pexels (licenza Pexels: uso commerciale gratuito, senza obbligo di citazione;
 * vietato rivendere le clip così come sono). Non consuma crediti b-roll AI.
 */
export class PexelsBrollProvider implements BrollProvider {
  readonly name = "pexels";
  constructor(private readonly apiKey: string) {}

  async find(req: BrollRequest) {
    const orientation = req.aspectRatio === "9:16" ? "portrait" : req.aspectRatio === "16:9" ? "landscape" : "square";
    const url = new URL("https://api.pexels.com/videos/search");
    url.searchParams.set("query", req.query);
    url.searchParams.set("orientation", orientation);
    url.searchParams.set("size", "medium");
    url.searchParams.set("per_page", "15");
    const res = await fetch(url, { headers: { Authorization: this.apiKey } });
    const cost = { provider: "pexels", costUsd: 0, units: { searches: 1 } };
    if (!res.ok) throw new Error(`Pexels: errore ${res.status}`);
    const data = (await res.json()) as { videos?: PexelsVideo[] };
    const exclude = new Set(req.excludeIds ?? []);
    for (const v of data.videos ?? []) {
      if (exclude.has(`pexels:${v.id}`) || v.duration < Math.min(req.durationS, 3)) continue;
      // File mp4 verticale più vicino a 1080 di larghezza, senza scaricare il 4K.
      const files = v.video_files
        .filter((f) => f.file_type === "video/mp4" && f.width && f.height && f.height >= f.width)
        .sort((a, b) => Math.abs((a.width ?? 0) - 1080) - Math.abs((b.width ?? 0) - 1080));
      const file = files[0];
      if (!file) continue;
      const clip: BrollClip = {
        id: `pexels:${v.id}`,
        downloadUrl: file.link,
        durationS: v.duration,
        width: file.width!,
        height: file.height!,
        source: "stock",
        creditsUsed: 0,
        attribution: { author: v.user.name, url: v.url },
      };
      return { clip, cost };
    }
    return { clip: null, cost };
  }
}

/** B-roll dimostrativo (sviluppo e test): il worker genera una clip colorata con FFmpeg. */
export class DemoBrollProvider implements BrollProvider {
  readonly name = "demo";
  async find(req: BrollRequest) {
    const clip: BrollClip = {
      id: `demo:${req.query}`,
      downloadUrl: `demo:${req.query}`,
      durationS: Math.max(4, req.durationS),
      width: 1080,
      height: 1920,
      source: "stock",
      creditsUsed: 0,
    };
    return { clip, cost: { provider: "demo", costUsd: 0 } };
  }
}

/** null = b-roll disattivato (nessuna chiave): i video escono senza b-roll. */
export function createBrollProvider(env: Record<string, string | undefined> = process.env): BrollProvider | null {
  const kind = env.BROLL_PROVIDER ?? "pexels";
  if (kind === "demo") {
    if (env.NODE_ENV === "production" && env.ALLOW_DEMO_PROVIDERS !== "true") {
      throw new Error("BROLL_PROVIDER=demo non è ammesso in produzione");
    }
    return new DemoBrollProvider();
  }
  if (kind === "none" || !env.PEXELS_API_KEY) return null;
  return new PexelsBrollProvider(env.PEXELS_API_KEY);
}
