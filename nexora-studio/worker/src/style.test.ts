import assert from "node:assert/strict";
import { test } from "node:test";

import type { EditPlan } from "./pipeline/plan.js";
import { editUserPrompt, planToSpec } from "./pipeline/plan.js";
import { type StyleProfile, styleDefaults, styleForPrompt } from "./pipeline/style.js";

const fast: StyleProfile = {
  version: 1,
  durationS: 30,
  cutsPerMinute: 32,
  avgShotS: 1.8,
  backgroundAudio: true,
  visual: {
    subtitles: { present: true, position: "centro", size: "grandi", uppercase: true, highlight: "karaoke", words_per_block: 2 },
    hook_text: true,
    keyword_emphasis: true,
    logo: "alto-destra",
    text_overlays: false,
    zoom: "frequente",
    broll: "poco",
    framing: "primo piano",
    energy: "energico",
    description: "Serrato, sottotitoli grandi.",
  },
};
const calm: StyleProfile = {
  ...fast,
  cutsPerMinute: 2,
  avgShotS: 25,
  backgroundAudio: false,
  visual: { ...fast.visual, subtitles: { ...fast.visual.subtitles, position: "basso", size: "piccoli", uppercase: false, highlight: "nessuno" }, zoom: "nessuno", energy: "calmo", hook_text: false },
};

const words = Array.from({ length: 30 }, (_, i) => ({ text: `w${i}`, start: i * 0.5 + (i % 5 === 0 ? 0.5 : 0), end: i * 0.5 + 0.35 + (i % 5 === 0 ? 0.5 : 0) }));
const plan = (over: Partial<EditPlan> = {}): EditPlan => ({
  keep: [{ from_word: 0, to_word: 29 }],
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
  keyword_emphasis: null,
  logo_watermark: null,
  music_volume: null,
  broll: [],
  caption: "",
  hashtags: [],
  notes: "",
  ...over,
});
const toSpec = (p: EditPlan, sd: ReturnType<typeof styleDefaults> | null) =>
  planToSpec({
    plan: p,
    words,
    source: { durationS: 16, width: 1080, height: 1920, fps: 30, hasAudio: true, orientation: "portrait" },
    editStyle: {},
    brandColor: null,
    music: [],
    seed: "x",
    hasLogo: false,
    styleDefaults: sd,
  });

test("riferimento serrato: sottotitoli grandi in maiuscolo al centro, karaoke, zoom, pause strette", () => {
  const spec = toSpec(plan(), styleDefaults(fast));
  assert.equal(spec.subtitles.size, "grandi");
  assert.equal(spec.subtitles.uppercase, true);
  assert.equal(spec.subtitles.position, "centro");
  assert.equal(spec.subtitles.style, "karaoke");
  assert.equal(spec.punchIn, true);
  // Pause strette: più segmenti (le pause da 0,65 s vengono tagliate)
  assert.ok(spec.segments.length > toSpec(plan(), styleDefaults(calm)).segments.length);
});

test("riferimento calmo: niente zoom, sottotitoli piccoli e puliti in basso", () => {
  const spec = toSpec(plan(), styleDefaults(calm));
  assert.equal(spec.punchIn, false);
  assert.equal(spec.subtitles.size, "piccoli");
  assert.equal(spec.subtitles.style, "pulito");
  assert.equal(spec.subtitles.position, "basso");
});

test("le scelte esplicite (indicazioni del cliente) vincono sul riferimento", () => {
  const spec = toSpec(plan({ subtitle_position: "alto", subtitle_uppercase: false, punch_in: false }), styleDefaults(fast));
  assert.equal(spec.subtitles.position, "alto");
  assert.equal(spec.subtitles.uppercase, false);
  assert.equal(spec.punchIn, false);
});

test("senza riferimento valgono i predefiniti di sempre", () => {
  const spec = toSpec(plan(), null);
  assert.equal(spec.subtitles.position, "auto");
  assert.equal(spec.subtitles.uppercase, false);
  assert.equal(spec.punchIn, true);
});

test("prompt: indicazioni del cliente e stile di riferimento prima della trascrizione", () => {
  const prompt = editUserPrompt({
    brand: { companyName: "Forno", city: null, toneOfVoice: null, doNotSay: null, editStyle: {} },
    script: null,
    words: words.slice(0, 3),
    clientNotes: "Ritmo veloce, niente musica",
    styleReference: styleForPrompt(fast, "STILE DI RIFERIMENTO (test)"),
  });
  const notes = prompt.indexOf("INDICAZIONI DEL CLIENTE");
  const style = prompt.indexOf("STILE DI RIFERIMENTO (test)");
  const transcript = prompt.indexOf("TRASCRIZIONE");
  assert.ok(notes > 0 && style > notes && transcript > style, "ordine delle sezioni");
  assert.match(prompt, /32 tagli al minuto/);
  assert.match(prompt, /sottotitoli grandi, in centro, in maiuscolo/);
});

test("riferimento con parole chiave in grande e logo fisso: effetti attivi solo se il brand ha il logo", () => {
  const sd = styleDefaults(fast);
  assert.equal(sd.keywordEmphasis, true);
  assert.equal(sd.logoWatermark, "alto-destra");
  const withLogo = planToSpec({
    plan: plan(), words, source: { durationS: 16, width: 1080, height: 1920, fps: 30, hasAudio: true, orientation: "portrait" },
    editStyle: {}, brandColor: null, music: [], seed: "x", hasLogo: true, styleDefaults: sd,
  });
  assert.equal(withLogo.subtitles.keywordEmphasis, true);
  assert.equal(withLogo.logoWatermark, "alto-destra");
  assert.equal(toSpec(plan(), sd).logoWatermark, "nessuno", "senza logo del brand niente logo fisso");
});

test("profili salvati prima dei nuovi campi: decide l'AI (nessun valore imposto)", () => {
  const old = { ...fast, visual: { ...fast.visual } } as StyleProfile;
  delete (old.visual as Partial<typeof old.visual>).keyword_emphasis;
  delete (old.visual as Partial<typeof old.visual>).logo;
  const sd = styleDefaults(old);
  assert.equal(sd.keywordEmphasis, null);
  assert.equal(sd.logoWatermark, null);
});

test("colore dell'alone: il più luminoso del brand", async () => {
  const { brightest } = await import("./pipeline/plan.js");
  assert.equal(brightest(["#0147f8", "#0026a7", "#03f6fc", "#24282b"]), "#03f6fc");
  assert.equal(brightest(["nonvalido"]), null);
});
