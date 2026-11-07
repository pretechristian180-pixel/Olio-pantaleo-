import assert from "node:assert/strict";
import { test } from "node:test";

import type { EditPlan } from "./pipeline/plan.js";
import { editUserPrompt, normalizeOrder, placeBroll } from "./pipeline/plan.js";

const words = Array.from({ length: 60 }, (_, i) => ({ text: `parola${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));
const segments = [{ start: 0, end: 30 }];
const plan = (broll: EditPlan["broll"]): EditPlan => ({
  keep: [{ from_word: 0, to_word: 59 }],
  highlight_words: [],
  subtitle_fixes: [],
  hook_overlay: null,
  music_mood: "nessuna",
  subtitle_size: null,
  subtitle_style: null,
  subtitle_position: null,
  subtitle_uppercase: null,
  subtitles_enabled: null,
  punch_in: null,
  pause_trim: null,
  music_volume: null,
  broll,
  caption: "",
  hashtags: [],
  notes: "",
});
const covers = [
  { n: 1, description: "il forno acceso", durationS: 8, storagePath: "ws/a/forno.mp4" },
  { n: 2, description: null, durationS: 2.5, storagePath: "ws/b/vetrina.mp4" },
];

test("ordine delle riprese: niente doppioni o numeri inventati, le dimenticate in coda", () => {
  assert.deepEqual(normalizeOrder([3, 1, 3, 9], [1, 2, 3]), [3, 1, 2]);
});

test("clip di copertura: dove le mette il modello, dal bucket raw, senza superarne la durata", () => {
  const placed = placeBroll(plan([{ at_word: 20, duration_s: 5, own_clip: 1, query_en: "" }]), words, segments, 0, covers);
  const forno = placed.find((b) => b.storagePath === "ws/a/forno.mp4")!;
  assert.equal(forno.bucket, "raw");
  assert.equal(forno.at, 10);
  assert.equal(forno.duration, 5);
  // La seconda clip, non collocata dal modello, finisce comunque in uno spazio libero
  const vetrina = placed.find((b) => b.storagePath === "ws/b/vetrina.mp4")!;
  assert.ok(vetrina.duration <= 2.4);
  assert.ok(vetrina.at >= 3 && vetrina.at + vetrina.duration <= 29);
  assert.ok(Math.abs(vetrina.at - forno.at) >= 1.5 + Math.min(vetrina.duration, forno.duration));
});

test("clip di copertura anche con b-roll stock disattivato; lo stock resta nel suo limite", () => {
  const placed = placeBroll(
    plan([
      { at_word: 20, duration_s: 3, own_clip: 1, query_en: "" },
      { at_word: 40, duration_s: 3, own_clip: null, query_en: "pizza oven" },
    ]),
    words,
    segments,
    0,
    covers.slice(0, 1),
  );
  assert.deepEqual(placed.map((b) => b.bucket), ["raw"]);
});

test("il prompt elenca le clip di copertura con descrizione e durata", () => {
  const prompt = editUserPrompt({
    brand: { companyName: "Forno Rossi", city: null, toneOfVoice: null, doNotSay: null, editStyle: {} },
    script: null,
    words: words.slice(0, 3),
    coverClips: covers,
  });
  assert.match(prompt, /Clip 1 \(8\.0 s\): il forno acceso/);
  assert.match(prompt, /Clip 2 \(2\.5 s\): nessuna descrizione/);
  assert.ok(prompt.indexOf("CLIP DI COPERTURA") < prompt.indexOf("TRASCRIZIONE"));
});
