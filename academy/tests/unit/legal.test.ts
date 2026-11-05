import { describe, expect, it } from "vitest";
import { isLegalComplete, legalLine, parseLegal } from "@/lib/legal";

describe("dati legali", () => {
  it("parse tollerante: campi mancanti o sbagliati diventano vuoti", () => {
    const d = parseLegal({ ragione_sociale: "  Studio Rossi Srl ", piva: 123, extra: "x" });
    expect(d.ragione_sociale).toBe("Studio Rossi Srl");
    expect(d.piva).toBe("");
    expect(parseLegal(null).email).toBe("");
  });
  it("completezza e riga legale", () => {
    const d = parseLegal({
      ragione_sociale: "A Srl",
      piva: "01234567890",
      sede: "Via Roma 1, Milano",
      email: "a@b.it",
    });
    expect(isLegalComplete(d)).toBe(true);
    expect(isLegalComplete(parseLegal({ ragione_sociale: "A" }))).toBe(false);
    expect(legalLine(d)).toBe("A Srl · P.IVA 01234567890 · Via Roma 1, Milano");
  });
});
