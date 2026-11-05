import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { execCommand } from "./exec.js";

export type MusicMood = "energica" | "rilassata" | "elegante";

export interface MusicTrack {
  id: string;
  title: string;
  mood: MusicMood;
  bpm: number;
  duration_s: number;
  /** Percorso locale dell'MP3. */
  path: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const MUSIC_GEN = join(here, "..", "python", "music_gen.py");

/**
 * Genera la libreria musicale iniziale (brani originali, nessun diritto di terzi) in `outDir`:
 * Python compone i brani, FFmpeg li converte in MP3 a -16 LUFS. Usato al build del worker.
 */
export async function buildMusicLibrary(outDir: string, python = process.env.PYTHON_BIN ?? "python3") {
  await mkdir(outDir, { recursive: true });
  await execCommand(python, [MUSIC_GEN, outDir], { timeoutMs: 15 * 60_000 });
  for (const f of await readdir(outDir)) {
    if (!f.endsWith(".wav")) continue;
    const wav = join(outDir, f);
    await execCommand("ffmpeg", [
      "-y", "-v", "error", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5", "-ar", "44100",
      "-c:a", "libmp3lame", "-b:a", "160k", wav.replace(/\.wav$/, ".mp3"),
    ]);
    await rm(wav);
  }
}

export async function loadMusicLibrary(dir: string): Promise<MusicTrack[]> {
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")) as {
    tracks: Omit<MusicTrack, "path">[];
  };
  return manifest.tracks.map((t) => ({ ...t, path: join(dir, `${t.id}.mp3`) }));
}

/** Sceglie un brano dell'atmosfera richiesta; `seed` (es. id del video) rende la scelta stabile. */
export function pickTrack(library: MusicTrack[], mood: MusicMood, seed: string): MusicTrack | null {
  const pool = library.filter((t) => t.mood === mood);
  const list = pool.length ? pool : library;
  if (!list.length) return null;
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length]!;
}
