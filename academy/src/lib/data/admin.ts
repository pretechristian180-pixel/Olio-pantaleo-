import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";

export type AdminCourseRow = {
  id: string;
  slug: string;
  titolo: string;
  stato: "draft" | "published";
  prezzo_cents: number;
  valuta: string;
  copertinaUrl: string | null;
  lezioni: number;
};

/** Tutti i corsi dell'academy (bozze comprese: le RLS le mostrano solo allo staff). */
export async function getAdminCourses(): Promise<AdminCourseRow[]> {
  const tenant = await getCurrentTenant();
  if (!tenant) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, titolo, stato, prezzo_cents, valuta, copertina_path, lessons(count)")
    .eq("tenant_id", tenant.id)
    .order("ordine")
    .order("creato_il");
  if (error) throw new Error(`Corsi non disponibili: ${error.message}`);
  return (data ?? []).map((c) => {
    const row = c as unknown as {
      id: string;
      slug: string;
      titolo: string;
      stato: "draft" | "published";
      prezzo_cents: number;
      valuta: string;
      copertina_path: string | null;
      lessons: { count: number }[];
    };
    return {
      id: row.id,
      slug: row.slug,
      titolo: row.titolo,
      stato: row.stato,
      prezzo_cents: row.prezzo_cents,
      valuta: row.valuta,
      copertinaUrl: row.copertina_path
        ? supabase.storage.from("copertine").getPublicUrl(row.copertina_path).data.publicUrl
        : null,
      lezioni: row.lessons?.[0]?.count ?? 0,
    };
  });
}

export type AdminLessonRow = {
  id: string;
  slug: string;
  titolo: string;
  ordine: number;
  durata_sec: number;
  is_free_preview: boolean;
  bunny_video_id: string | null;
};
export type AdminModuleRow = {
  id: string;
  titolo: string;
  ordine: number;
  lessons: AdminLessonRow[];
};
export type AdminCourseDetail = {
  id: string;
  tenant_id: string;
  slug: string;
  titolo: string;
  sottotitolo: string | null;
  descrizione: string | null;
  categoria: string | null;
  risultati: { titolo: string; testo: string }[];
  prezzo_cents: number;
  valuta: string;
  stato: "draft" | "published";
  docente_id: string | null;
  copertina_path: string | null;
  copertinaUrl: string | null;
  modules: AdminModuleRow[];
};
export type Instructor = { id: string; nome: string; qualifica: string | null };

export async function getAdminCourse(
  id: string,
): Promise<{ course: AdminCourseDetail; instructors: Instructor[] } | null> {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  const supabase = await createClient();
  const [{ data, error }, { data: instructors }] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, tenant_id, slug, titolo, sottotitolo, descrizione, categoria, risultati, prezzo_cents, valuta, stato, docente_id, copertina_path, modules(id, titolo, ordine, lessons(id, slug, titolo, ordine, durata_sec, is_free_preview, bunny_video_id))",
      )
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    supabase
      .from("instructors")
      .select("id, nome, qualifica")
      .eq("tenant_id", tenant.id)
      .order("nome"),
  ]);
  if (error) throw new Error(`Corso non disponibile: ${error.message}`);
  if (!data) return null;
  const c = data as unknown as Omit<AdminCourseDetail, "copertinaUrl">;
  const modules = [...(c.modules ?? [])]
    .sort((a, b) => a.ordine - b.ordine)
    .map((m) => ({ ...m, lessons: [...(m.lessons ?? [])].sort((a, b) => a.ordine - b.ordine) }));
  return {
    course: {
      ...c,
      risultati: Array.isArray(c.risultati) ? c.risultati : [],
      modules,
      copertinaUrl: c.copertina_path
        ? supabase.storage.from("copertine").getPublicUrl(c.copertina_path).data.publicUrl
        : null,
    },
    instructors: (instructors ?? []) as Instructor[],
  };
}

export type AdminLessonDetail = AdminLessonRow & {
  descrizione: string | null;
  module_id: string;
  course_id: string;
  resources: {
    id: string;
    nome: string;
    tipo: string;
    storage_path: string;
    dimensione_bytes: number;
  }[];
  course: { id: string; titolo: string; slug: string; tenant_id: string };
};

export async function getAdminLesson(id: string): Promise<AdminLessonDetail | null> {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(
      "id, slug, titolo, ordine, durata_sec, is_free_preview, bunny_video_id, descrizione, module_id, course_id, courses!inner(id, titolo, slug, tenant_id), lesson_resources(id, nome, tipo, storage_path, dimensione_bytes, ordine)",
    )
    .eq("id", id)
    .eq("courses.tenant_id", tenant.id)
    .maybeSingle();
  if (error) throw new Error(`Lezione non disponibile: ${error.message}`);
  if (!data) return null;
  const l = data as unknown as AdminLessonDetail & {
    courses: AdminLessonDetail["course"];
    lesson_resources: (AdminLessonDetail["resources"][number] & { ordine: number })[];
  };
  return {
    ...l,
    course: l.courses,
    resources: [...(l.lesson_resources ?? [])].sort((a, b) => a.ordine - b.ordine),
  };
}
