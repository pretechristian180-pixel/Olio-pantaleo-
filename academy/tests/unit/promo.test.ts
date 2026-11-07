import { describe, expect, it } from "vitest";
import { isPromoVisible, parsePromo, safePromoLink } from "@/lib/promo";

describe("riquadro promozionale", () => {
  it("accetta solo link sicuri", () => {
    expect(safePromoLink("https://calendly.com/freely/consulenza")).toBe(
      "https://calendly.com/freely/consulenza",
    );
    expect(safePromoLink("http://sito.it")).toBe("");
    expect(safePromoLink("javascript:alert(1)")).toBe("");
    expect(safePromoLink("mailto:info@freely.it")).toBe("mailto:info@freely.it");
    expect(safePromoLink("tel:+39 333 1234567")).toBe("tel:+393331234567");
  });
  it("visibile solo se acceso e con testo", () => {
    expect(isPromoVisible(parsePromo({ attivo: true, testo: "Prenota" }))).toBe(true);
    expect(isPromoVisible(parsePromo({ attivo: true, testo: "  " }))).toBe(false);
    expect(isPromoVisible(parsePromo({ testo: "Prenota" }))).toBe(false);
    expect(isPromoVisible(parsePromo(null))).toBe(false);
  });
});
