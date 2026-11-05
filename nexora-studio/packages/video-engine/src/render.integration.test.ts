/**
 * Test d'integrazione: monta davvero un video con FFmpeg e OpenCV.
 * Si attiva con RENDER_TESTS=1 (serve PYTHON_BIN con opencv) e FACE_IMAGE (foto con un volto).
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { execCommand } from "./exec.js";
import { detectFaces } from "./faces.js";
import { probeVideo } from "./probe.js";
import { renderVideo } from "./render.js";
import { silenceCut } from "./timeline.js";
import type { EditSpec } from "./edit-spec.js";
import type { Word } from "./types.js";

const enabled = process.env.RENDER_TESTS === "1" && process.env.FACE_IMAGE && existsSync(process.env.FACE_IMAGE);

/** Girato di prova 1080x1920, 8 s, con il volto messo in basso (dove andrebbero i sottotitoli). */
async function makeSource(dir: string, faceTopPx: number) {
  const out = join(dir, `src-${faceTopPx}.mp4`);
  await execCommand("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", "color=c=0x334455:s=1080x1920:d=8:r=30",
    "-loop", "1", "-i", process.env.FACE_IMAGE!,
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000:duration=8",
    "-filter_complex", `[1:v]scale=1080:-1[img];[0:v][img]overlay=0:${faceTopPx}:shortest=1[v]`,
    "-map", "[v]", "-map", "2:a", "-t", "8", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", out,
  ]);
  return out;
}

const words: Word[] = Array.from({ length: 12 }, (_, i) => ({
  text: ["Questa", "è", "una", "prova", "dei", "sottotitoli", "che", "non", "devono", "coprire", "il", "volto."][i]!,
  start: 0.5 + i * 0.55,
  end: 0.5 + i * 0.55 + 0.45,
}));

function spec(): EditSpec {
  return {
    version: 1,
    segments: silenceCut(words, 8),
    subtitles: { enabled: true, style: "evidenziato", size: "medi", highlightWordIndices: [5], highlightColor: "#0A5CFF", font: "Inter" },
    music: null,
    hookOverlay: "Prova del motore",
    outroLogo: false,
    framing: "cover",
    broll: [],
  };
}

test("render reale: i sottotitoli si spostano sopra un volto in basso", { skip: !enabled }, async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "nx-render-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [faceTop, expectedY] of [[1250, 576], [-60, 1382]] as const) {
    const src = await makeSource(dir, faceTop);
    const info = await probeVideo(src);
    assert.equal(info.orientation, "portrait");
    const faces = await detectFaces(src, { fps: 2 });
    assert.ok(faces.some((f) => f.faces.length > 0), "volto rilevato");
    const out = join(dir, `out-${faceTop}.mp4`);
    const res = await renderVideo({ workDir: dir, sourcePath: src, source: info, words, faces, spec: spec(), outputPath: out });
    const ass = await readFile(join(dir, "subs.ass"), "utf8");
    const ys = [...ass.matchAll(/^Dialogue: 0.*\\pos\(540,(\d+)\)/gm)].map((m) => Number(m[1]));
    const hookY = Number(/^Dialogue: 1.*\\pos\(540,(\d+)\)/m.exec(ass)?.[1]);
    // Volto in alto → frase d'apertura spostata al centro; volto in basso → resta in alto.
    assert.equal(hookY, faceTop < 0 ? 960 : 250, `frase d'apertura a ${hookY}`);
    assert.ok(ys.length > 0);
    assert.ok(ys.every((y) => y === expectedY), `volto a ${faceTop}px: posizioni ${[...new Set(ys)]}`);
    const outInfo = await probeVideo(out);
    assert.equal(outInfo.width, 1080);
    assert.equal(outInfo.height, 1920);
    assert.ok(Math.abs(outInfo.durationS - res.durationS) < 0.2);
  }
});
