import { execCommand } from "./exec.js";
import type { SourceInfo } from "./types.js";

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  tags?: { rotate?: string };
  side_data_list?: { rotation?: number }[];
}

/** Legge durata, dimensioni (ruotate come le vede l'utente), fps e audio con ffprobe. */
export async function probeVideo(path: string): Promise<SourceInfo> {
  const json = await execCommand("ffprobe", [
    "-v", "error", "-print_format", "json", "-show_streams", "-show_format", path,
  ], { timeoutMs: 60_000 });
  const data = JSON.parse(json) as { streams: FfprobeStream[]; format: { duration?: string } };
  const video = data.streams.find((s) => s.codec_type === "video");
  if (!video?.width || !video.height) throw new Error("Il file non contiene un video leggibile");
  const rotation = Math.abs(
    Number(video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0),
  );
  const rotated = rotation === 90 || rotation === 270;
  const width = rotated ? video.height : video.width;
  const height = rotated ? video.width : video.height;
  const [num, den] = (video.avg_frame_rate ?? "30/1").split("/").map(Number);
  const fps = num && den ? num / den : 30;
  const ratio = width / height;
  return {
    durationS: Number(data.format.duration ?? 0),
    width,
    height,
    fps,
    hasAudio: data.streams.some((s) => s.codec_type === "audio"),
    orientation: ratio < 0.9 ? "portrait" : ratio > 1.1 ? "landscape" : "square",
  };
}
