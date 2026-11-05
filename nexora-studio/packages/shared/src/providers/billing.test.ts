import assert from "node:assert/strict";
import { test } from "node:test";

import { mapProviderStatus } from "./billing.js";
import { DemoBillingProvider, demoPeriodEnd, demoSign, snapshotFromStripe } from "./stripe.js";

test("stati Stripe tradotti: solo active/trialing consentono montaggi", () => {
  assert.equal(mapProviderStatus("active"), "active");
  assert.equal(mapProviderStatus("trialing"), "active");
  assert.equal(mapProviderStatus("past_due"), "past_due");
  assert.equal(mapProviderStatus("incomplete_expired"), "incomplete");
  assert.equal(mapProviderStatus("paused"), "unpaid");
});

test("periodo dalla voce dell'abbonamento (API recenti) o dall'abbonamento (vecchie)", () => {
  const base = { id: "sub_1", customer: "cus_1", status: "active", cancel_at_period_end: false, cancel_at: null, metadata: { workspace_id: "ws" } };
  const recent = snapshotFromStripe({ ...base, items: { data: [{ price: { id: "price_1", recurring: { interval: "year" } }, current_period_start: 1_800_000_000, current_period_end: 1_831_536_000 }] } } as never);
  assert.equal(recent.priceId, "price_1");
  assert.equal(recent.interval, "year");
  assert.equal(recent.periodStart?.getTime(), 1_800_000_000_000);
  assert.equal(recent.workspaceId, "ws");
  const legacy = snapshotFromStripe({ ...base, current_period_start: 1_700_000_000, current_period_end: 1_702_592_000, items: { data: [{ price: { id: "p", recurring: { interval: "month" } } }] } } as never);
  assert.equal(legacy.periodEnd?.getTime(), 1_702_592_000_000);
});

test("demo: webhook con firma sbagliata rifiutato, link di checkout non manomettibile", async () => {
  const demo = new DemoBillingProvider("segreto", "http://localhost:3000");
  const body = JSON.stringify({ id: "evt_1", type: "payment.failed", customerId: "c", subscriptionId: null });
  await assert.rejects(demo.parseWebhook(body, "x"));
  assert.equal((await demo.parseWebhook(body, demoSign(body, "segreto"))).type, "payment.failed");

  const { url } = await demo.createCheckout({ workspaceId: "ws", customerId: null, email: "a@b.it", priceId: "price_pro", planId: "pro", interval: "month", couponId: null, successUrl: "", cancelUrl: "" });
  const t = new URL(url).searchParams.get("t")!;
  assert.equal(demo.readCheckoutToken(t)?.priceId, "price_pro");
  const [b, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(b!, "base64url").toString()), priceId: "price_business" })).toString("base64url");
  assert.equal(demo.readCheckoutToken(`${forged}.${sig}`), null);
});

test("periodo demo: mese e anno", () => {
  const start = new Date("2026-01-31T10:00:00Z");
  assert.equal(demoPeriodEnd(start, "year").toISOString(), "2027-01-31T10:00:00.000Z");
});
