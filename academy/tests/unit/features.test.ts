import { describe, expect, it } from "vitest";
import {
  effectiveFeatures,
  omaggioScaduto,
  overridesFromForm,
  parseOverrides,
} from "@/lib/features";

const pro = {
  max_landing_ai_mese: 30,
  max_sezioni_ai_mese: null,
  max_ore_video: 50,
  max_studenti_attivi: 1000,
  max_staff: 3,
  dominio_personalizzato: true,
  senza_marchio_nexora: true,
  abbonamenti_studenti: false,
};

describe("funzioni dell'academy", () => {
  it("senza eccezioni valgono quelle del piano", () => {
    const f = effectiveFeatures(pro, {});
    expect(f.max_ore_video).toBe(50);
    expect(f.landing_ia).toBe(true);
    expect(f.abbonamenti_studenti).toBe(false);
  });
  it("le eccezioni vincono; null = illimitato; valori strani ignorati", () => {
    const f = effectiveFeatures(pro, {
      max_ore_video: null,
      abbonamenti_studenti: true,
      max_staff: "tanti",
      landing_ia: false,
      chiave_ignota: 1,
    });
    expect(f.max_ore_video).toBeNull();
    expect(f.abbonamenti_studenti).toBe(true);
    expect(f.max_staff).toBe(3);
    expect(f.landing_ia).toBe(false);
    expect(parseOverrides([1, 2])).toEqual({});
  });
  it("dal modulo salva solo le differenze dal piano", () => {
    const fd = new FormData();
    fd.set("f_landing_ia", "on");
    fd.set("f_max_landing_ai_mese", "30");
    fd.set("f_max_sezioni_ai_mese", "");
    fd.set("f_max_ore_video", "");
    fd.set("f_max_studenti_attivi", "1000");
    fd.set("f_max_staff", "5");
    fd.set("f_dominio_personalizzato", "on");
    fd.set("f_senza_marchio_nexora", "on");
    fd.set("f_abbonamenti_studenti", "on");
    expect(overridesFromForm(fd, pro)).toEqual({
      max_ore_video: null,
      max_staff: 5,
      abbonamenti_studenti: true,
    });
  });
  it("scadenza dell'omaggio", () => {
    const now = Date.UTC(2026, 10, 7);
    expect(omaggioScaduto(true, null, now)).toBe(false);
    expect(omaggioScaduto(true, "2026-11-01T00:00:00Z", now)).toBe(true);
    expect(omaggioScaduto(true, "2027-01-01T00:00:00Z", now)).toBe(false);
    expect(omaggioScaduto(false, "2026-11-01T00:00:00Z", now)).toBe(false);
  });
});
