import { describe, expect, it } from "vitest";
import { buildOutline, lessonEyebrow, type OutlineRow } from "@/lib/course-outline";

const row = (o: Partial<OutlineRow>): OutlineRow => ({
  module_id: "m1",
  module_titolo: "Modulo",
  module_ordine: 1,
  lesson_id: null,
  lesson_slug: null,
  lesson_titolo: null,
  durata_sec: 0,
  is_free_preview: false,
  lesson_ordine: 0,
  ...o,
});

describe("buildOutline", () => {
  const rows: OutlineRow[] = [
    row({
      module_id: "m2",
      module_titolo: "Secondo",
      module_ordine: 2,
      lesson_id: "c",
      lesson_slug: "c",
      lesson_titolo: "C",
      durata_sec: 300,
      lesson_ordine: 1,
    }),
    row({
      lesson_id: "b",
      lesson_slug: "b",
      lesson_titolo: "B",
      durata_sec: 120,
      lesson_ordine: 2,
    }),
    row({
      lesson_id: "a",
      lesson_slug: "a",
      lesson_titolo: "A",
      durata_sec: 60,
      lesson_ordine: 1,
      is_free_preview: true,
    }),
    row({ module_id: "m3", module_titolo: "Vuoto", module_ordine: 3 }),
  ];

  it("raggruppa per modulo nell'ordine giusto", () => {
    const o = buildOutline(rows);
    expect(o.moduli.map((m) => m.titolo)).toEqual(["Modulo", "Secondo", "Vuoto"]);
    expect(o.moduli[0]?.lezioni.map((l) => l.slug)).toEqual(["a", "b"]);
    expect(o.moduli[2]?.lezioni).toHaveLength(0);
  });

  it("calcola totali e lezioni gratuite", () => {
    const o = buildOutline(rows);
    expect(o.totaleLezioni).toBe(3);
    expect(o.totaleDurataSec).toBe(480);
    expect(o.lezioniGratuite).toBe(1);
    expect(o.moduli[0]?.durataSec).toBe(180);
  });

  it("genera il sopratitolo della lezione", () => {
    const o = buildOutline(rows);
    expect(lessonEyebrow(o, "b")).toBe("Modulo 1 · Lezione 2");
    expect(lessonEyebrow(o, "c")).toBe("Modulo 2 · Lezione 1");
    expect(lessonEyebrow(o, "zzz")).toBeNull();
  });
});
