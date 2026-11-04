import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signedEmbedUrl } from "@/lib/bunny";
import { nextLessonToWatch, nextProgress } from "@/lib/progress";
import { safeNext } from "@/lib/safe-redirect";

describe("safeNext", () => {
  it("accetta percorsi interni", () => {
    expect(safeNext("/app/corsi/x")).toBe("/app/corsi/x");
  });
  it("blocca URL esterni e trucchi", () => {
    for (const bad of ["https://evil.it", "//evil.it", "/\\evil.it", "app", "/ok\r\nSet-Cookie:x"]) {
      expect(safeNext(bad)).toBe("/app");
    }
    expect(safeNext(null, "/")).toBe("/");
  });
});

describe("signedEmbedUrl", () => {
  it("firma come richiesto da Bunny", () => {
    const now = 1_800_000_000_000;
    const { url, expires } = signedEmbedUrl({ libraryId: "123", videoId: "abc", tokenKey: "k", ttlSec: 3600, now });
    expect(expires).toBe(1_800_000_000 + 3600);
    const token = createHash("sha256").update("kabc" + expires).digest("hex");
    expect(url).toContain(`https://iframe.mediadelivery.net/embed/123/abc?token=${token}&expires=${expires}`);
    expect(url).not.toContain("&t=");
  });
  it("aggiunge il punto di ripresa", () => {
    const { url } = signedEmbedUrl({ libraryId: "1", videoId: "v", tokenKey: "k", startAt: 494.7 });
    expect(url).toContain("&t=494");
  });
});

describe("nextProgress", () => {
  it("accumula i secondi visti con un tetto per invio", () => {
    const a = nextProgress(null, { secondo: 10, delta: 10, durataSec: 600 });
    const b = nextProgress(a, { secondo: 300, delta: 290, durataSec: 600 });
    expect(a.secondi_visti).toBe(10);
    expect(b.secondi_visti).toBe(25);
    expect(b.ultimo_secondo).toBe(300);
    expect(b.completata).toBe(false);
  });
  it("completa oltre il 90% e non torna indietro", () => {
    const c = nextProgress(null, { secondo: 540, delta: 10, durataSec: 600 });
    expect(c.completata).toBe(true);
    const d = nextProgress(c, { secondo: 20, delta: 10, durataSec: 600 });
    expect(d.completata).toBe(true);
  });
  it("a fine video riparte da zero", () => {
    expect(nextProgress(null, { secondo: 598, delta: 5, durataSec: 600 }).ultimo_secondo).toBe(0);
  });
});

describe("nextLessonToWatch", () => {
  const ls = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("prende la prima non completata", () => {
    expect(nextLessonToWatch(ls, new Set(["a"]))?.id).toBe("b");
  });
  it("se è tutto fatto riparte dalla prima", () => {
    expect(nextLessonToWatch(ls, new Set(["a", "b", "c"]))?.id).toBe("a");
  });
});
