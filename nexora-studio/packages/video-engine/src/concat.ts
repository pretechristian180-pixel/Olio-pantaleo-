import { execCommand, ffmpegThreads } from "./exec.js";
import type { SourceInfo, Word } from "./types.js";

export interface ClipInput {
  path: string;
  info: SourceInfo;
}

const f3 = (n: number) => n.toFixed(3);

/** Formato del girato unito: quello della maggioranza delle riprese (a parità vince la prima). */
export function concatTarget(clips: SourceInfo[]): { width: number; height: number } {
  const count = { portrait: 0, landscape: 0, square: 0 };
  for (const c of clips) count[c.orientation] += 1;
  const first = clips[0]?.orientation ?? "portrait";
  const best = (Object.keys(count) as (keyof typeof count)[]).reduce(
    (a, b) => (count[b] > count[a] ? b : a),
    first,
  );
  if (best === "landscape") return { width: 1920, height: 1080 };
  if (best === "square") return { width: 1080, height: 1080 };
  return { width: 1080, height: 1920 };
}

/**
 * Argomenti di FFmpeg per unire le riprese in un unico girato: stesse dimensioni (senza
 * tagliare: bande nere se il formato è diverso), 30 fps, audio stereo a 48 kHz. Ogni ripresa
 * dura esattamente quanto letto da ffprobe, così i tempi delle parole si possono spostare.
 */
export function buildConcatArgs(clips: ClipInput[], outputPath: string) {
  const { width: W, height: H } = concatTarget(clips.map((c) => c.info));
  const threads = ffmpegThreads();
  const args = ["-y", "-v", "error", "-filter_complex_threads", threads];
  for (const c of clips) args.push("-threads", threads, "-i", c.path);

  const f: string[] = [];
  const pairs: string[] = [];
  clips.forEach((c, i) => {
    const d = f3(c.info.durationS);
    f.push(
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,` +
        `setsar=1,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=1,trim=duration=${d},setpts=PTS-STARTPTS[v${i}]`,
    );
    if (c.info.hasAudio) {
      f.push(
        `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=${d},atrim=duration=${d},asetpts=PTS-STARTPTS[a${i}]`,
      );
    } else {
      f.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${d}[a${i}]`);
    }
    pairs.push(`[v${i}][a${i}]`);
  });
  f.push(`${pairs.join("")}concat=n=${clips.length}:v=1:a=1[vout][aout]`);

  args.push(
    "-filter_complex", f.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-threads", threads,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-movflags", "+faststart",
    outputPath,
  );
  return { args, width: W, height: H };
}

/** Unisce le riprese nell'ordine dato. */
export async function concatClips(clips: ClipInput[], outputPath: string) {
  if (!clips.length) throw new Error("Nessuna ripresa da unire");
  const { args } = buildConcatArgs(clips, outputPath);
  await execCommand("ffmpeg", args, { timeoutMs: 30 * 60_000 });
}

/** Trascrizioni delle singole riprese → trascrizione del girato unito (tempi spostati). */
export function concatWords(parts: { words: Word[]; durationS: number }[]): Word[] {
  const out: Word[] = [];
  let offset = 0;
  for (const p of parts) {
    for (const w of p.words) {
      out.push({ text: w.text, start: round(w.start + offset), end: round(w.end + offset) });
    }
    offset += p.durationS;
  }
  return out;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
