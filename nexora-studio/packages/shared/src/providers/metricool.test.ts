import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMetricoolPost, localDateTime } from "./metricool.js";
import { postText } from "./publishing.js";

test("data locale per Metricool (ora di Roma)", () => {
  assert.equal(localDateTime(new Date("2026-11-09T11:30:00Z"), "Europe/Rome"), "2026-11-09T12:30:00");
  assert.equal(localDateTime(new Date("2026-07-06T10:30:00Z"), "Europe/Rome"), "2026-07-06T12:30:00");
});

test("testo del post: didascalia e hashtag", () => {
  assert.equal(postText("Vieni a trovarci!", ["bari", "#pizza"]), "Vieni a trovarci!\n\n#bari #pizza");
});

test("corpo del post: Reel/Short su tutte le reti, pubblicazione automatica", () => {
  const body = buildMetricoolPost({
    brandRef: "123",
    platforms: ["instagram", "facebook", "tiktok", "youtube"],
    videoUrl: "https://example.com/v.mp4",
    caption: "Ciao",
    hashtags: ["bari"],
    title: "Il forno",
    publishAt: new Date("2026-11-09T11:30:00Z"),
    timezone: "Europe/Rome",
  }) as Record<string, any>;
  assert.deepEqual(body.publicationDate, { dateTime: "2026-11-09T12:30:00", timezone: "Europe/Rome" });
  assert.deepEqual(body.providers, [{ network: "instagram" }, { network: "facebook" }, { network: "tiktok" }, { network: "youtube" }]);
  assert.equal(body.autoPublish, true);
  assert.equal(body.instagramData.type, "REEL");
  assert.equal(body.facebookData.type, "REEL");
  assert.equal(body.youtubeData.type, "short");
  assert.equal(body.youtubeData.madeForKids, false);
  assert.equal(body.linkedinData, undefined, "solo le reti richieste");
  assert.deepEqual(body.media, ["https://example.com/v.mp4"]);
});
