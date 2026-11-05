import { describe, expect, it } from "vitest";
import {
  hasContent,
  parseSections,
  sectionsFromAi,
  SECTION_ORDER,
  type AiLanding,
} from "@/lib/landing/sections";

const ai: AiLanding = {
  hero: {
    sopratitolo: "Videocorso",
    titolo: "Fatture senza paura",
    sottotitolo: "In 3 ore.",
    cta: "Inizia ora",
  },
  problema: { titolo: "Ti suona familiare?", intro: "", punti: ["Scadenze dimenticate", ""] },
  risultati: {
    titolo: "Cosa porti a casa",
    items: [{ titolo: "Calendario", testo: "Tutte le scadenze." }],
  },
  per_chi: { titolo: "Per chi è", si: ["Freelance"], no: [] },
  programma: { titolo: "Il programma", intro: "" },
  docente: { titolo: "Chi ti accompagna" },
  bonus: { titolo: "Bonus", items: [] },
  garanzia: { titolo: "Garanzia", testo: "" },
  faq: { titolo: "Domande", items: [{ domanda: "Quanto dura?", risposta: "3 ore." }] },
  cta_finale: { titolo: "Pronto?", testo: "Inizia oggi.", cta: "Acquista" },
};

describe("sezioni della landing", () => {
  it("rispetta l'ordine standard e toglie le voci vuote", () => {
    const s = sectionsFromAi(ai);
    expect(s.map((x) => x.tipo)).toEqual(SECTION_ORDER);
    const problema = s.find((x) => x.tipo === "problema")!;
    expect(problema.dati).toMatchObject({ punti: ["Scadenze dimenticate"] });
  });
  it("nasconde bonus e garanzia se il brief non li prevede", () => {
    const s = sectionsFromAi(ai);
    expect(s.find((x) => x.tipo === "bonus")!.visibile).toBe(false);
    expect(s.find((x) => x.tipo === "garanzia")!.visibile).toBe(false);
    expect(s.find((x) => x.tipo === "hero")!.visibile).toBe(true);
  });
  it("tronca i testi troppo lunghi e scarta tipi sconosciuti", () => {
    const s = parseSections([
      { id: "a", tipo: "hero", dati: { titolo: "x".repeat(500) } },
      { id: "b", tipo: "script", dati: {} },
      { tipo: "garanzia", visibile: false, dati: { testo: "14 giorni" } },
    ]);
    expect(s).toHaveLength(2);
    expect((s[0]!.dati as { titolo: string }).titolo).toHaveLength(140);
    expect(s[1]!.visibile).toBe(false);
    expect(hasContent(s[1]!)).toBe(true);
  });
  it("dati non validi diventano vuoti invece di rompere la pagina", () => {
    const s = parseSections([{ tipo: "faq", dati: { items: "non una lista" } }]);
    expect(s[0]!.dati).toEqual({ titolo: "", items: [] });
  });
});
