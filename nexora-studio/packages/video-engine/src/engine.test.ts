import assert from "node:assert/strict";
import { test } from "node:test";

import type { EditSpec } from "./edit-spec.js";
import { mapFaceToOutput } from "./framing.js";
import { buildRenderArgs, selectExpr } from "./render.js";
import { assColor, buildAss, chooseY, chunkWords } from "./subtitles.js";
import { outputToSource, remapWords, segmentsFromWordRanges, silenceCut, sourceToOutput, totalDuration } from "./timeline.js";
import type { SourceInfo, Word } from "./types.js";

const words: Word[] = [
  { text: "Sai", start: 0.5, end: 0.7 },
  { text: "quante", start: 0.75, end: 1.0 },
  { text: "ore", start: 1.05, end: 1.3 },
  { text: "lievita?", start: 1.35, end: 1.8 },
  // pausa lunga (2 s): da accorciare
  { text: "Ventiquattro.", start: 3.8, end: 4.4 },
  { text: "Anzi", start: 4.5, end: 4.7 },
  { text: "no", start: 4.75, end: 4.9 },
  { text: "quarantotto.", start: 5.0, end: 5.6 },
];

export const baseSpec = (over: Partial<EditSpec> = {}): EditSpec => ({
  version: 1,
  segments: [{ start: 0, end: 6 }],
  subtitles: { enabled: true, style: "evidenziato", size: "medi", highlightWordIndices: [7], highlightColor: "#0A5CFF", font: "Inter", fixes: [], position: "auto", uppercase: false },
  music: null,
  hookOverlay: null,
  outroLogo: false,
  framing: "cover",
  punchIn: false,
  voiceCleanup: false,
  broll: [],
  ...over,
});

test("taglio dei silenzi: la pausa lunga sparisce", () => {
  const segs = silenceCut(words, 6);
  assert.equal(segs.length, 2);
  assert.ok(totalDuration(segs) < 4, `durata ${totalDuration(segs)}`);
  assert.ok(Math.abs(segs[0]!.start - 0.42) < 1e-9);
});

test("intervalli di parole: errore ('Ventiquattro. Anzi no') tagliato via", () => {
  const segs = segmentsFromWordRanges(words, [{ from: 0, to: 3 }, { from: 7, to: 7 }], 6);
  assert.equal(segs.length, 2);
  const kept = remapWords(words, segs).map((w) => w.text);
  assert.deepEqual(kept, ["Sai", "quante", "ore", "lievita?", "quarantotto."]);
});

test("conversione tempi girato ↔ montato", () => {
  const segs = [{ start: 1, end: 3 }, { start: 5, end: 6 }];
  assert.equal(sourceToOutput(2, segs), 1);
  assert.equal(sourceToOutput(4, segs), null);
  assert.equal(sourceToOutput(5.5, segs), 2.5);
  assert.equal(outputToSource(2.5, segs), 5.5);
});

test("blocchi di sottotitoli brevi, spezzati sulla punteggiatura", () => {
  const timed = remapWords(words, silenceCut(words, 6));
  const chunks = chunkWords(timed, "medi");
  assert.ok(chunks.every((c) => c.words.length <= 3));
  assert.equal(chunks[0]!.words.map((w) => w.text).join(" "), "Sai quante ore");
  assert.equal(chunks[1]!.words.map((w) => w.text).join(" "), "lievita?");
});

test("posizione dei sottotitoli: evita il volto", () => {
  assert.equal(chooseY([], 76), 0.72, "senza volti: posizione standard");
  assert.equal(chooseY([{ x: 0.3, y: 0.15, w: 0.4, h: 0.3 }], 76), 0.72, "volto in alto: standard");
  assert.equal(chooseY([{ x: 0.3, y: 0.6, w: 0.4, h: 0.12 }], 76), 0.84, "volto appena sotto il centro: più giù");
  assert.equal(chooseY([{ x: 0.3, y: 0.62, w: 0.4, h: 0.3 }], 76), 0.3, "volto grande in basso: sopra");
});

test("colori ASS e file .ass", () => {
  assert.equal(assColor("#0A5CFF"), "&H00FF5C0A");
  const ass = buildAss({ words: remapWords(words, silenceCut(words, 6)), spec: baseSpec(), facesAt: () => [] });
  assert.match(ass, /PlayResY: 1920/);
  assert.match(ass, /\{\\c&H00FF5C0A&?\}?quarantotto\./);
  assert.match(ass, /\\pos\(540,1382\)/);
});

test("box del volto dal girato orizzontale al 9:16 con sfondo sfocato", () => {
  const src: Pick<SourceInfo, "width" | "height"> = { width: 1920, height: 1080 };
  const out = mapFaceToOutput({ x: 0.4, y: 0.2, w: 0.2, h: 0.3 }, src, "fit")!;
  // video scalato a 1080x607.5, centrato verticalmente (offset 656.25)
  assert.ok(Math.abs(out.y - (0.2 * 607.5 + 656.25) / 1920) < 1e-6);
  assert.ok(Math.abs(out.h - (0.3 * 607.5) / 1920) < 1e-6);
});

test("argomenti FFmpeg: tagli, musica con ducking, logo finale", () => {
  const spec = baseSpec({ segments: [{ start: 0.4, end: 1.9 }, { start: 4.9, end: 5.8 }], music: { trackId: "x", volume: 0.12 }, outroLogo: true });
  const { args, durationS } = buildRenderArgs(
    {
      workDir: "/tmp", sourcePath: "in.mp4", outputPath: "out.mp4", words, faces: [], spec,
      source: { durationS: 6, width: 1080, height: 1920, fps: 30, hasAudio: true, orientation: "portrait" },
      musicPath: "m.mp3", logoPath: "logo.png",
    },
    "subs.ass",
  );
  const graph = args[args.indexOf("-filter_complex") + 1]!;
  assert.match(graph, new RegExp(selectExpr(spec.segments).replace(/[()+.]/g, "\\$&")));
  assert.match(graph, /sidechaincompress/);
  assert.match(graph, /concat=n=2:v=1:a=1/);
  assert.match(graph, /loudnorm=I=-14/);
  assert.ok(Math.abs(durationS - (1.5 + 0.9 + 1.6)) < 1e-9);
  assert.ok(args.includes("-stream_loop"));
});

test("ogni video esportato porta la marcatura AI nei metadati", () => {
  const { args } = buildRenderArgs(
    {
      workDir: "/tmp", sourcePath: "in.mp4", outputPath: "out.mp4", words, faces: [], spec: baseSpec({}),
      source: { durationS: 6, width: 1080, height: 1920, fps: 30, hasAudio: true, orientation: "portrait" },
    },
    "subs.ass",
  );
  const joined = args.join(" ");
  assert.match(joined, /ai_generated=edited/);
  assert.match(joined, /comment=Video montato con intelligenza artificiale/);
  assert.ok(args.includes("+faststart+use_metadata_tags"));
});

test("render: zoom alternato sui tagli e voce ripulita quando attivi", () => {
  const spec = baseSpec({ segments: [{ start: 0, end: 2 }, { start: 3, end: 5 }], punchIn: true, voiceCleanup: true });
  const { args } = buildRenderArgs(
    {
      workDir: "/tmp", sourcePath: "in.mp4", outputPath: "out.mp4", words, faces: [], spec,
      source: { durationS: 6, width: 1080, height: 1920, fps: 30, hasAudio: true, orientation: "portrait" },
    },
    "subs.ass",
  );
  const graph = args[args.indexOf("-filter_complex") + 1]!;
  assert.match(graph, /scale=1188:2112,crop=1080:1920:54:67/);
  assert.match(graph, /overlay=0:0:enable='between\(t,2\.000,4\.000\)'\[vzoom\]/);
  assert.match(graph, /\[vzoom\]ass=subs\.ass/);
  assert.match(graph, /\[0:a\]highpass=f=80,afftdn=nf=-28:tn=1,aselect/);
});
