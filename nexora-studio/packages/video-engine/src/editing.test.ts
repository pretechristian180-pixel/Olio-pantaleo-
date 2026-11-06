import assert from "node:assert/strict";
import { test } from "node:test";

import { ENVELOPE_HOP, snapSegmentsToSilence } from "./audio.js";
import { zoomWindows } from "./render.js";
import { applySubtitleFixes, remapWords } from "./timeline.js";

/** Inviluppo finto: parlato (-20 dB) negli intervalli dati, silenzio (-60 dB) altrove. */
function envelope(duration: number, speech: [number, number][]) {
  const env = new Float32Array(Math.round(duration / ENVELOPE_HOP));
  for (let i = 0; i < env.length; i++) {
    const t = i * ENVELOPE_HOP;
    env[i] = speech.some(([a, b]) => t >= a && t < b) ? -20 : -60;
  }
  return env;
}

test("tagli nei silenzi: l'inizio anticipa prima dell'attacco, la fine aspetta l'ultima sillaba", () => {
  // Whisper stima la parola da 1.10 a 2.00, ma la voce va da 1.00 a 2.20
  const env = envelope(4, [[1.0, 2.2]]);
  const [s] = snapSegmentsToSilence([{ start: 1.02, end: 2.18 }], env, 4);
  assert.ok(s!.start <= 1.0 && s!.start >= 0.77, `inizio ${s!.start}`);
  assert.ok(s!.end >= 2.2 && s!.end <= 2.48, `fine ${s!.end}`);
});

test("tagli nei silenzi: mai oltre i limiti, segmenti vicini non si sovrappongono", () => {
  const env = envelope(3, [[0.5, 1.4], [1.5, 2.5]]);
  const out = snapSegmentsToSilence([{ start: 0.55, end: 1.38 }, { start: 1.52, end: 2.45 }], env, 3);
  assert.equal(out.length, 2);
  assert.ok(out[0]!.end <= out[1]!.start, JSON.stringify(out));
  assert.ok(out[1]!.end <= 3);
});

test("correzioni dei sottotitoli: stesso numero di parole, tempi dell'audio, testo corretto", () => {
  const words = [
    { text: "più", start: 0, end: 0.3 },
    { text: "al", start: 0.35, end: 0.5 },
    { text: "compost.", start: 0.55, end: 1.0 },
    { text: "Basta", start: 1.2, end: 1.5 },
  ];
  const fixed = applySubtitleFixes(words, [{ from: 1, to: 2, text: "alcun post." }]);
  assert.equal(fixed.length, 4);
  assert.deepEqual(fixed[1], { text: "alcun post.", start: 0.35, end: 1.0 });
  assert.equal(fixed[2]!.text, "");
  const shown = remapWords(fixed, [{ start: 0, end: 2 }]).filter((w) => w.text);
  assert.deepEqual(shown.map((w) => w.text), ["più", "alcun post.", "Basta"]);
  assert.deepEqual(shown.map((w) => w.index), [0, 1, 3]);
});

test("correzioni dei sottotitoli: ignorate se sovrapposte, vuote o troppo lunghe", () => {
  const words = Array.from({ length: 20 }, (_, i) => ({ text: `w${i}`, start: i, end: i + 0.5 }));
  const fixed = applySubtitleFixes(words, [
    { from: 2, to: 3, text: "ok" },
    { from: 3, to: 4, text: "sovrapposta" },
    { from: 6, to: 6, text: "  " },
    { from: 0, to: 19, text: "riscrittura intera" },
  ]);
  assert.deepEqual(fixed.map((w) => w.text).slice(0, 7), ["w0", "w1", "ok", "", "w4", "w5", "w6"]);
});

test("zoom alternato: solo sui segmenti dispari lunghi almeno 1,2 s, in tempo del montato", () => {
  const z = zoomWindows([
    { start: 0, end: 2 },
    { start: 5, end: 7 },
    { start: 9, end: 9.5 },
    { start: 12, end: 13 },
  ]);
  assert.deepEqual(z, [{ start: 2, end: 4 }]);
});
