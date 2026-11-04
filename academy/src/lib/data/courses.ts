import "server-only";
import { cache } from "react";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { buildOutline, type Outline, type OutlineRow } from "@/lib/course-outline";

export type Risultato = { titolo: string; testo: string };

type CourseRow = {
  id: string;
  slug: string;
  titolo: string;
  sottotitolo: string | null;
  descrizione: string | null;
  categoria: string | null;
  risultati: Risultato[];
  prezzo_cents: number;
  valuta: string;
  copertina_path: string | null;
  trailer_video_id: string | null;
  instructors: { nome: string; qualifica: string | null; bio: string | null } | null;
};

export type Course = Omit<CourseRow, "instructors" | "copertina_path"> & {
  copertinaUrl: string | null;
  docente: CourseRow["instructors"];
  outline: Outline;
};

const COURSE_COLUMNS =
  "id, slug, titolo, sottotitolo, descrizione, categoria, risultati, prezzo_cents, valuta, copertina_path, trailer_video_id, instructors(nome, qualifica, bio), tenants!inner(slug)";

async function hydrate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: CourseRow,
): Promise<Course> {
  const { data: outlineRows, error } = await supabase.rpc("course_outline", {
    p_course_id: row.id,
  });
  if (error) throw new Error(`Programma del corso non disponibile: ${error.message}`);
  const { instructors, copertina_path, risultati, ...rest } = row;
  return {
    ...rest,
    risultati: Array.isArray(risultati)
      ? risultati.filter((r): r is Risultato => typeof r?.titolo === "string")
      : [],
    docente: instructors,
    copertinaUrl: copertina_path
      ? supabase.storage.from("copertine").getPublicUrl(copertina_path).data.publicUrl
      : null,
    outline: buildOutline((outlineRows ?? []) as OutlineRow[]),
  };
}

/** Corsi pubblicati del tenant corrente, con programma e durata. */
export const getPublishedCourses = cache(async (): Promise<Course[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("tenants.slug", publicEnv.NEXT_PUBLIC_TENANT_SLUG)
    .eq("stato", "published")
    .order("ordine");
  if (error) throw new Error(`Catalogo non disponibile: ${error.message}`);
  return Promise.all(((data ?? []) as unknown as CourseRow[]).map((row) => hydrate(supabase, row)));
});

export const getCourseBySlug = cache(async (slug: string): Promise<Course | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("tenants.slug", publicEnv.NEXT_PUBLIC_TENANT_SLUG)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Corso non disponibile: ${error.message}`);
  if (!data) return null;
  return hydrate(supabase, data as unknown as CourseRow);
});
