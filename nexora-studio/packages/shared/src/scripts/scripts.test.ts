import assert from "node:assert/strict";
import { test } from "node:test";

import { FakeLLMProvider } from "../providers/fake-llm.js";
import { easterSunday, italianDates, mondayOf, weekContext } from "./calendar.js";
import { generateWeeklyScripts, regenerateScript } from "./generate.js";
import type { BrandContext } from "./prompt.js";
import type { ScriptDraft } from "./schema.js";
import { findRepetitions, similarity } from "./similarity.js";

const brand: BrandContext = {
  companyName: "Pizzeria Da Mario",
  sector: "ristorazione",
  city: "Bari",
  toneOfVoice: "Simpatico, diretto",
  targetAudience: "Famiglie di Bari",
  services: "Pizza napoletana, consegna a domicilio",
  doNotSay: "Non parlare di prezzi",
};

function draft(title: string, hook: string, tags: string[]): ScriptDraft {
  return {
    title,
    format: "talking_head",
    hook,
    body: "Riga uno.\nRiga due.",
    call_to_action: "Passa a trovarci.",
    shooting_notes: { location: "Al banco", framing: "Verticale", light: "Finestra", duration_seconds: 200, tips: ["a", "b"] },
    topic_tags: tags,
  };
}

test("Pasqua e date mobili", () => {
  assert.deepEqual(easterSunday(2026), { m: 4, d: 5 });
  assert.deepEqual(easterSunday(2027), { m: 3, d: 28 });
  const d2026 = italianDates(2026);
  assert.equal(d2026.find((d) => d.label === "Black Friday")?.date, "2026-11-27");
  assert.equal(d2026.find((d) => d.label === "Festa della mamma")?.date, "2026-05-10");
});

test("lunedì della settimana in ora italiana", () => {
  assert.equal(mondayOf(new Date("2026-11-08T22:30:00Z")), "2026-11-02"); // domenica 23:30 a Roma
  assert.equal(mondayOf(new Date("2026-11-08T23:30:00Z")), "2026-11-09"); // lunedì 00:30 a Roma
  assert.equal(mondayOf(new Date("2026-11-05T10:00:00Z")), "2026-11-02");
});

test("contesto della settimana: date in arrivo e filtro per settore", () => {
  const ctx = weekContext("2026-11-23", 21, "ristorazione");
  assert.equal(ctx.season, "autunno");
  assert.ok(ctx.upcoming.some((d) => d.label === "Black Friday"));
  assert.ok(ctx.upcoming.some((d) => d.label.startsWith("Immacolata")));
  const jan = weekContext("2026-12-28", 21, "ristorazione");
  assert.ok(jan.upcoming.some((d) => d.date === "2027-01-06"), "attraversa l'anno");
  assert.ok(!jan.upcoming.some((d) => d.label.includes("saldi")), "saldi solo per il retail");
});

test("somiglianza: stesso tema riconosciuto, temi diversi no", () => {
  const a = { title: "Come nasce il nostro impasto", hook: "Sai quante ore lievita la nostra pizza?", topicTags: ["impasto", "lievitazione"] };
  const b = { title: "Il segreto del nostro impasto", hook: "Quante ore lievita davvero una pizza?", topicTags: ["impasto", "lievitazione"] };
  const c = { title: "Consegna a domicilio a Bari", hook: "Arriva calda anche a Poggiofranco", topicTags: ["consegna"] };
  assert.ok(similarity(a, b) >= 0.6);
  assert.ok(similarity(a, c) < 0.3);
  assert.deepEqual(findRepetitions([b, c], [a]).map((r) => r.index), [0]);
});

test("generazione settimanale: sostituisce lo script ripetuto e normalizza", async () => {
  const fake = new FakeLLMProvider([
    () => ({
      scripts: [
        draft("Il segreto del nostro impasto", "Quante ore lievita davvero una pizza?", ["impasto", "lievitazione"]),
        draft("Consegna a domicilio a Bari", "Arriva calda anche a Poggiofranco", ["consegna"]),
        draft("Il forno a legna", "Perché il nostro forno arriva a 450 gradi", ["forno"]),
      ],
    }),
    () => ({ scripts: [draft("La mozzarella del lunedì", "Da dove arriva la nostra mozzarella", ["mozzarella", "fornitori"])] }),
  ]);
  const res = await generateWeeklyScripts(fake, {
    brand,
    weekStart: "2026-11-09",
    count: 3,
    past: [{ weekStart: "2026-11-02", title: "Come nasce il nostro impasto", hook: "Sai quante ore lievita la nostra pizza?", topicTags: ["impasto", "lievitazione"] }],
  });
  assert.equal(fake.calls.length, 2, "una chiamata di correzione");
  assert.deepEqual(res.value.map((s) => s.title), ["Consegna a domicilio a Bari", "Il forno a legna", "La mozzarella del lunedì"]);
  assert.equal(res.value[0]!.shooting_notes.duration_seconds, 90, "durata limitata a 90 s");
  const prompt = fake.calls[0]!.messages[0]!.content;
  assert.match(prompt, /Come nasce il nostro impasto/, "lo storico è nel prompt");
  assert.match(prompt, /Scrivi 3 script/);
  assert.match(fake.calls[1]!.messages[0]!.content, /Scrivi 1 script/);
});

test("rigenerazione singola: include feedback e script fratelli", async () => {
  const fake = new FakeLLMProvider([() => ({ script: draft("Pizza senza glutine", "Anche chi è celiaco può mangiarla?", ["senza glutine"]) })]);
  const res = await regenerateScript(fake, {
    brand,
    weekStart: "2026-11-09",
    current: { title: "Il forno a legna", hook: "Perché 450 gradi", format: "talking_head" },
    siblings: [{ title: "Consegna a domicilio a Bari", hook: "Arriva calda" }],
    past: [],
    feedback: "Troppo tecnico",
  });
  assert.equal(res.value.title, "Pizza senza glutine");
  const prompt = fake.calls[0]!.messages[0]!.content;
  assert.match(prompt, /Troppo tecnico/);
  assert.match(prompt, /Consegna a domicilio a Bari/);
  assert.equal(fake.calls[0]!.system.includes("Pizzeria"), false, "system prompt stabile, senza dati dell'azienda");
});
