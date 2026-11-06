import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { execCommand, ffmpegThreads } from "./exec.js";
import type { FaceBox, FaceSample } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
export const FACE_MODEL = join(here, "..", "assets", "models", "face_detection_yunet_2023mar.onnx");
const FACES_PY = join(here, "..", "python", "faces.py");

/**
 * Rileva i volti nel girato: FFmpeg estrae `fps` fotogrammi al secondo (già ruotati),
 * Python + OpenCV (YuNet) trova i volti. `python` è l'interprete con opencv installato.
 */
export async function detectFaces(
  videoPath: string,
  opts: { fps?: number; python?: string; width?: number } = {},
): Promise<FaceSample[]> {
  const fps = opts.fps ?? 2;
  const dir = await mkdtemp(join(tmpdir(), "nx-faces-"));
  try {
    await execCommand("ffmpeg", [
      "-v", "error", "-threads", ffmpegThreads(), "-i", videoPath,
      "-vf", `fps=${fps},scale=${opts.width ?? 360}:-2`,
      "-q:v", "4", join(dir, "frame_%06d.jpg"),
    ], { timeoutMs: 10 * 60_000 });
    const json = await execCommand(opts.python ?? process.env.PYTHON_BIN ?? "python3", [FACES_PY, dir, String(fps), FACE_MODEL], {
      timeoutMs: 10 * 60_000,
    });
    const raw = JSON.parse(json) as { t: number; faces: number[][] }[];
    return raw.map((s) => ({
      t: s.t,
      faces: s.faces.map(([x, y, w, h]) => ({ x: x!, y: y!, w: w!, h: h! })),
    }));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Volti visibili in un intervallo del girato (unione dei campioni nell'intervallo, ± mezzo secondo). */
export function facesBetween(samples: FaceSample[], start: number, end: number): FaceBox[] {
  return samples.filter((s) => s.t >= start - 0.5 && s.t <= end + 0.5).flatMap((s) => s.faces);
}
