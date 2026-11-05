import { describe, expect, it } from "vitest";
import {
  lookupKeyFor,
  originFromHost,
  planFromLookupKey,
  tenantStatusFromSubscription,
  trialEndFor,
} from "@/lib/billing";

describe("prezzi dei piani", () => {
  it("lookup key andata e ritorno", () => {
    expect(lookupKeyFor("pro", "mese")).toBe("nexora_pro_mese");
    expect(planFromLookupKey("nexora_business_anno")).toBe("business");
    expect(planFromLookupKey("nexora_gold_mese")).toBeNull();
    expect(planFromLookupKey(null)).toBeNull();
  });
});

describe("stato dell'academy dall'abbonamento", () => {
  it("mappa gli stati Stripe", () => {
    expect(tenantStatusFromSubscription("active")).toBe("attivo");
    expect(tenantStatusFromSubscription("trialing")).toBe("prova");
    expect(tenantStatusFromSubscription("past_due")).toBe("insoluto");
    expect(tenantStatusFromSubscription("unpaid")).toBe("insoluto");
    expect(tenantStatusFromSubscription("canceled")).toBe("sospeso");
    expect(tenantStatusFromSubscription("qualcosa")).toBe("sospeso");
  });
});

describe("fine prova", () => {
  const now = Date.UTC(2026, 10, 5, 12);
  it("passa la fine della prova solo se mancano almeno 48 ore", () => {
    expect(trialEndFor(new Date(now + 5 * 86400_000).toISOString(), now)).toBe(
      Math.floor((now + 5 * 86400_000) / 1000),
    );
    expect(trialEndFor(new Date(now + 3600_000).toISOString(), now)).toBeUndefined();
    expect(trialEndFor(null, now)).toBeUndefined();
    expect(trialEndFor("non-una-data", now)).toBeUndefined();
  });
});

describe("origine per i ritorni da Stripe", () => {
  it("https in produzione, http in locale", () => {
    expect(originFromHost("studio.academy.nexoragruppodigitale.it")).toBe(
      "https://studio.academy.nexoragruppodigitale.it",
    );
    expect(originFromHost("studio.localhost:3000")).toBe("http://studio.localhost:3000");
    expect(originFromHost("")).toBeNull();
  });
});
