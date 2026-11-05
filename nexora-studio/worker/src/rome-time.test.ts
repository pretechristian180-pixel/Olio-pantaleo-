import assert from "node:assert/strict";
import { test } from "node:test";

import { romeNow, targetWeeks, weeklyEmailDue } from "./rome-time.js";

test("ora di Roma con ora legale e solare", () => {
  assert.deepEqual(romeNow(new Date("2026-07-05T16:30:00Z")), { isoDow: 7, hour: 18, date: "2026-07-05" }); // CEST +2
  assert.deepEqual(romeNow(new Date("2026-11-08T17:30:00Z")), { isoDow: 7, hour: 18, date: "2026-11-08" }); // CET +1
  assert.equal(romeNow(new Date("2026-11-08T23:30:00Z")).isoDow, 1); // lunedì 00:30 a Roma
});

test("settimane da preparare: domenica sera anche la successiva", () => {
  assert.deepEqual(targetWeeks(new Date("2026-11-05T10:00:00Z"), 18), ["2026-11-02"]);
  assert.deepEqual(targetWeeks(new Date("2026-11-07T10:00:00Z"), 18), []); // sabato
  assert.deepEqual(targetWeeks(new Date("2026-11-08T16:59:00Z"), 18), []); // domenica 17:59 a Roma
  assert.deepEqual(targetWeeks(new Date("2026-11-08T17:00:00Z"), 18), ["2026-11-09"]);
});

test("email del lunedì dalle 8 in poi", () => {
  assert.equal(weeklyEmailDue(new Date("2026-11-09T06:59:00Z"), "2026-11-09", 8), false); // 07:59
  assert.equal(weeklyEmailDue(new Date("2026-11-09T07:00:00Z"), "2026-11-09", 8), true); // 08:00
  assert.equal(weeklyEmailDue(new Date("2026-11-11T05:00:00Z"), "2026-11-09", 8), true); // mercoledì
  assert.equal(weeklyEmailDue(new Date("2026-11-08T20:00:00Z"), "2026-11-09", 8), false); // domenica sera
});
