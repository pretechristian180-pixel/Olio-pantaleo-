/** Logica pura sul programma di un corso (testata con Vitest). */

export type OutlineRow = {
  module_id: string;
  module_titolo: string;
  module_ordine: number;
  lesson_id: string | null;
  lesson_slug: string | null;
  lesson_titolo: string | null;
  durata_sec: number | null;
  is_free_preview: boolean | null;
  lesson_ordine: number | null;
};

export type OutlineLesson = {
  id: string;
  slug: string;
  titolo: string;
  durataSec: number;
  isFreePreview: boolean;
};

export type OutlineModule = {
  id: string;
  titolo: string;
  numero: number;
  durataSec: number;
  lezioni: OutlineLesson[];
};

export type Outline = {
  moduli: OutlineModule[];
  totaleLezioni: number;
  totaleDurataSec: number;
  lezioniGratuite: number;
};

/** Raggruppa le righe di course_outline() per modulo, rispettando l'ordine. */
export function buildOutline(rows: OutlineRow[]): Outline {
  const sorted = [...rows].sort(
    (a, b) => a.module_ordine - b.module_ordine || (a.lesson_ordine ?? 0) - (b.lesson_ordine ?? 0),
  );
  const byId = new Map<string, OutlineModule>();
  for (const r of sorted) {
    let mod = byId.get(r.module_id);
    if (!mod) {
      mod = {
        id: r.module_id,
        titolo: r.module_titolo,
        numero: byId.size + 1,
        durataSec: 0,
        lezioni: [],
      };
      byId.set(r.module_id, mod);
    }
    if (r.lesson_id && r.lesson_slug && r.lesson_titolo) {
      const durata = Math.max(0, r.durata_sec ?? 0);
      mod.lezioni.push({
        id: r.lesson_id,
        slug: r.lesson_slug,
        titolo: r.lesson_titolo,
        durataSec: durata,
        isFreePreview: Boolean(r.is_free_preview),
      });
      mod.durataSec += durata;
    }
  }
  const moduli = [...byId.values()];
  const lezioni = moduli.flatMap((m) => m.lezioni);
  return {
    moduli,
    totaleLezioni: lezioni.length,
    totaleDurataSec: lezioni.reduce((s, l) => s + l.durataSec, 0),
    lezioniGratuite: lezioni.filter((l) => l.isFreePreview).length,
  };
}

/** Etichetta "MODULO 3 · LEZIONE 4" per la lezione indicata, o null se non esiste. */
export function lessonEyebrow(outline: Outline, lessonSlug: string) {
  for (const m of outline.moduli) {
    const idx = m.lezioni.findIndex((l) => l.slug === lessonSlug);
    if (idx >= 0) return `Modulo ${m.numero} · Lezione ${idx + 1}`;
  }
  return null;
}
