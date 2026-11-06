import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildConcatArgs, concatClips, concatTarget, concatWords } from "./concat.js";
import { execCommand } from "./exec.js";
import { probeVideo } from "./probe.js";
import type { SourceInfo } from "./types.js";

const info = (over: Partial<SourceInfo> = {}): SourceInfo => ({
  durationS: 2,
  width: 1080,
  height: 1920,
  fps: 30,
  hasAudio: true,
  orientation: "portrait",
  ...over,
});

test("formato del girato unito: quello della maggioranza, a parità la prima ripresa", () => {
  assert.deepEqual(concatTarget([info(), info({ orientation: "landscape" }), info()]), { width: 1080, height: 1920 });
  assert.deepEqual(concatTarget([info({ orientation: "landscape" }), info()]), { width: 1920, height: 1080 });
});

test("unione: ogni ripresa tagliata alla sua durata, silenzio dove manca l'audio", () => {
  const { args } = buildConcatArgs(
    [
      { path: "a.mp4", info: info({ durationS: 2.5 }) },
      { path: "b.mov", info: info({ durationS: 1.25, hasAudio: false, orientation: "landscape", width: 1920, height: 1080 }) },
    ],
    "out.mp4",
  );
  const graph = args[args.indexOf("-filter_complex") + 1]!;
  assert.match(graph, /\[0:v\]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920/);
  assert.match(graph, /trim=duration=2\.500/);
  assert.match(graph, /anullsrc=r=48000:cl=stereo,atrim=duration=1\.250\[a1\]/);
  assert.match(graph, /\[v0\]\[a0\]\[v1\]\[a1\]concat=n=2:v=1:a=1/);
});

test("trascrizione unita: tempi spostati della durata delle riprese precedenti", () => {
  const words = concatWords([
    { words: [{ text: "Ciao", start: 0.2, end: 0.5 }], durationS: 2.5 },
    { words: [{ text: "a", start: 0.1, end: 0.2 }, { text: "tutti", start: 0.3, end: 0.6 }], durationS: 1 },
  ]);
  assert.deepEqual(words, [
    { text: "Ciao", start: 0.2, end: 0.5 },
    { text: "a", start: 2.6, end: 2.7 },
    { text: "tutti", start: 2.8, end: 3.1 },
  ]);
});

test("unione reale con FFmpeg: durata uguale alla somma, formati diversi", { timeout: 120_000 }, async (t) => {
  try {
    await execCommand("ffmpeg", ["-version"]);
  } catch {
    t.skip("FFmpeg non disponibile");
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), "nx-concat-"));
  try {
    const a = join(dir, "a.mp4");
    const b = join(dir, "b.mp4");
    await execCommand("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=720x1280:d=1.5:r=25", "-f", "lavfi", "-i", "sine=f=440:d=1.5", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", a]);
    await execCommand("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=1280x720:d=1:r=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", b]);
    const clips = [
      { path: a, info: await probeVideo(a) },
      { path: b, info: await probeVideo(b) },
    ];
    const out = join(dir, "out.mp4");
    await concatClips(clips, out);
    const res = await probeVideo(out);
    assert.equal(res.width, 1080);
    assert.equal(res.height, 1920);
    assert.ok(res.hasAudio);
    const expected = clips[0]!.info.durationS + clips[1]!.info.durationS;
    assert.ok(Math.abs(res.durationS - expected) < 0.15, `durata ${res.durationS} invece di ${expected}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
