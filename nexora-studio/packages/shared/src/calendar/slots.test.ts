import assert from "node:assert/strict";
import { test } from "node:test";

import { localParts, nextFreeSlot, zonedToUtc } from "./slots.js";

test("ora di Roma → UTC con ora solare e legale", () => {
  assert.equal(zonedToUtc("2026-11-09", "12:30", "Europe/Rome").toISOString(), "2026-11-09T11:30:00.000Z");
  assert.equal(zonedToUtc("2026-07-06", "12:30", "Europe/Rome").toISOString(), "2026-07-06T10:30:00.000Z");
  assert.equal(zonedToUtc("2027-03-28", "12:30", "Europe/Rome").toISOString(), "2027-03-28T10:30:00.000Z"); // giorno del cambio
});

test("primo spazio libero: giorni scelti, anticipo minimo, giorni occupati", () => {
  const base = { postingDays: [1, 3, 5], postingTime: "12:30", timeZone: "Europe/Rome" };
  // giovedì 5 novembre 10:00 Roma → venerdì 6 alle 12:30
  const thu = new Date("2026-11-05T09:00:00Z");
  assert.equal(nextFreeSlot({ ...base, after: thu, takenDays: [] })!.toISOString(), "2026-11-06T11:30:00.000Z");
  // venerdì occupato → lunedì 9
  assert.equal(nextFreeSlot({ ...base, after: thu, takenDays: ["2026-11-06"] })!.toISOString(), "2026-11-09T11:30:00.000Z");
  // lunedì alle 12:00 con anticipo di 60 min → non lo stesso giorno, mercoledì
  const mon = new Date("2026-11-09T11:00:00Z");
  assert.equal(nextFreeSlot({ ...base, after: mon, takenDays: [] })!.toISOString(), "2026-11-11T11:30:00.000Z");
  assert.equal(localParts(new Date("2026-11-11T11:30:00Z"), "Europe/Rome").time, "12:30");
});
