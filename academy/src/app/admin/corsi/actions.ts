"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { deleteBunnyVideo } from "@/lib/bunny-admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { slugify } from "@/lib/tenant-host";

export type FormState =
  | null
  | { ok: true; message?: string }
  | { ok: false; error: string; fields?: Record<string, string> };
type Result = { ok: true } | { ok: false; error: string };

const GENERIC = "Non siamo riusciti a salvare. Riprova tra poco.";
const uuid = z.string().uuid();

function fieldsOf(error: z.ZodError) {
  const f: Record<string, string> = {};
  for (const i of error.issues) f[String(i.path[0])] ??= i.message;
  return f;
}

async function ctx() {
  await requireStaff();
  const tenant = await getCurrentTenant();
  if (!tenant) throw new Error("Academy non trovata");
  return { tenant, supabase: await createClient() };
}

/** Slug libero: "corso", "corso-2", "corso-3"… */
async function freeSlug(base: string, taken: (s: string) => Promise<boolean>) {
  const root = slugify(base) || "nuovo";
  for (let i = 1; i < 50; i++) {
    const s = i === 1 ? root : `${root}-${i}`.slice(0, 60);
    if (!(await taken(s))) return s;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function refresh(courseId?: string) {
  revalidatePath("/admin/corsi");
  if (courseId) revalidatePath(`/admin/corsi/${courseId}`, "layout");
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Corsi
// ---------------------------------------------------------------------------

export async function createCourse(_p: FormState, formData: FormData): Promise<FormState> {
  const { tenant, supabase } = await ctx();
  const parsed = z
    .string()
    .trim()
    .min(3, "Dai un titolo al corso (almeno 3 caratteri).")
    .max(160)
    .safeParse(formData.get("titolo"));
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]!.message,
      fields: { titolo: parsed.error.issues[0]!.message },
    };
  const slug = await freeSlug(parsed.data, async (s) => {
    const { count } = await supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("slug", s);
    return (count ?? 0) > 0;
  });
  const { data, error } = await supabase
    .from("courses")
    .insert({
      tenant_id: tenant.id,
      titolo: parsed.data,
      slug,
      stato: "draft",
      ordine: Date.now() % 1_000_000,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: GENERIC };
  refresh();
  redirect(`/admin/corsi/${data.id}`);
}

const courseSchema = z.object({
  id: uuid,
  titolo: z.string().trim().min(3, "Il titolo deve avere almeno 3 caratteri.").max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo lettere minuscole, numeri e trattini.")
    .max(80),
  sottotitolo: z.string().trim().max(300, "Al massimo 300 caratteri."),
  descrizione: z.string().trim().max(20000),
  categoria: z.string().trim().max(60),
  prezzo: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => /^\d{1,5}(\.\d{1,2})?$/.test(v), "Scrivi un prezzo valido, es. 197 o 49,90."),
  docente_id: z.union([uuid, z.literal("")]),
  risultati: z.string().transform((v, c) => {
    try {
      const arr = JSON.parse(v) as { titolo: string; testo: string }[];
      return arr
        .map((r) => ({
          titolo: String(r.titolo ?? "")
            .trim()
            .slice(0, 80),
          testo: String(r.testo ?? "")
            .trim()
            .slice(0, 300),
        }))
        .filter((r) => r.titolo);
    } catch {
      c.addIssue({ code: "custom", message: "Risultati non validi." });
      return z.NEVER;
    }
  }),
});

export async function updateCourse(_p: FormState, formData: FormData): Promise<FormState> {
  const { tenant, supabase } = await ctx();
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: "Controlla i campi evidenziati.", fields: fieldsOf(parsed.error) };
  const d = parsed.data;
  const { data: clash } = await supabase
    .from("courses")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("slug", d.slug)
    .neq("id", d.id)
    .maybeSingle();
  if (clash)
    return {
      ok: false,
      error: "Controlla i campi evidenziati.",
      fields: { slug: "Un altro corso usa già questo indirizzo." },
    };
  const { error } = await supabase
    .from("courses")
    .update({
      titolo: d.titolo,
      slug: d.slug,
      sottotitolo: d.sottotitolo || null,
      descrizione: d.descrizione || null,
      categoria: d.categoria || null,
      prezzo_cents: Math.round(Number(d.prezzo) * 100),
      docente_id: d.docente_id || null,
      risultati: d.risultati,
    })
    .eq("id", d.id)
    .eq("tenant_id", tenant.id);
  if (error) return { ok: false, error: GENERIC };
  refresh(d.id);
  return { ok: true, message: "Corso salvato." };
}

export async function setCourseStatus(
  courseId: string,
  stato: "draft" | "published",
): Promise<Result> {
  const { tenant, supabase } = await ctx();
  if (stato === "published") {
    const { count } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId);
    if (!count)
      return { ok: false, error: "Aggiungi almeno una lezione prima di pubblicare il corso." };
  }
  const { error } = await supabase
    .from("courses")
    .update({
      stato,
      ...(stato === "published" ? { pubblicato_il: new Date().toISOString() } : {}),
    })
    .eq("id", courseId)
    .eq("tenant_id", tenant.id);
  if (error) return { ok: false, error: GENERIC };
  refresh(courseId);
  return { ok: true };
}

export async function deleteCourse(courseId: string): Promise<Result> {
  const { tenant, supabase } = await ctx();
  const { count: iscritti } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  if (iscritti)
    return {
      ok: false,
      error: "Il corso ha già degli iscritti: rimettilo in bozza invece di eliminarlo.",
    };
  const { data: videos } = await supabase
    .from("lessons")
    .select("bunny_video_id")
    .eq("course_id", courseId);
  const { error, count } = await supabase
    .from("courses")
    .delete({ count: "exact" })
    .eq("id", courseId)
    .eq("tenant_id", tenant.id);
  if (error || !count)
    return { ok: false, error: "Solo l'amministratore dell'academy può eliminare un corso." };
  await Promise.all(
    (videos ?? [])
      .filter((v) => v.bunny_video_id)
      .map((v) => deleteBunnyVideo(v.bunny_video_id as string)),
  );
  refresh();
  redirect("/admin/corsi");
}

export async function setCourseCover(courseId: string, path: string | null): Promise<Result> {
  const { tenant, supabase } = await ctx();
  if (path && !path.startsWith(`${tenant.id}/`))
    return { ok: false, error: "Percorso non valido." };
  const { error } = await supabase
    .from("courses")
    .update({ copertina_path: path })
    .eq("id", courseId)
    .eq("tenant_id", tenant.id);
  if (error) return { ok: false, error: GENERIC };
  refresh(courseId);
  return { ok: true };
}

export async function createInstructor(_p: FormState, formData: FormData): Promise<FormState> {
  const { tenant, supabase } = await ctx();
  const parsed = z
    .object({
      nome: z.string().trim().min(2, "Scrivi nome e cognome.").max(120),
      qualifica: z.string().trim().max(160),
      bio: z.string().trim().max(4000),
      courseId: uuid,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: "Controlla i campi.", fields: fieldsOf(parsed.error) };
  const { nome, qualifica, bio, courseId } = parsed.data;
  const { data, error } = await supabase
    .from("instructors")
    .insert({ tenant_id: tenant.id, nome, qualifica: qualifica || null, bio: bio || null })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: GENERIC };
  await supabase
    .from("courses")
    .update({ docente_id: data.id })
    .eq("id", courseId)
    .eq("tenant_id", tenant.id);
  refresh(courseId);
  return { ok: true, message: "Docente aggiunto e collegato al corso." };
}

// ---------------------------------------------------------------------------
// Programma: moduli, lezioni, ordine
// ---------------------------------------------------------------------------

export async function createModule(courseId: string, titolo: string): Promise<Result> {
  const { supabase } = await ctx();
  const t = titolo.trim();
  if (t.length < 2) return { ok: false, error: "Dai un titolo al modulo." };
  const { data: last } = await supabase
    .from("modules")
    .select("ordine")
    .eq("course_id", courseId)
    .order("ordine", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("modules")
    .insert({ course_id: courseId, titolo: t.slice(0, 160), ordine: (last?.ordine ?? 0) + 1 });
  if (error) return { ok: false, error: GENERIC };
  refresh(courseId);
  return { ok: true };
}

export async function renameModule(
  courseId: string,
  moduleId: string,
  titolo: string,
): Promise<Result> {
  const { supabase } = await ctx();
  const t = titolo.trim();
  if (t.length < 2) return { ok: false, error: "Il titolo è troppo corto." };
  const { error } = await supabase
    .from("modules")
    .update({ titolo: t.slice(0, 160) })
    .eq("id", moduleId)
    .eq("course_id", courseId);
  if (error) return { ok: false, error: GENERIC };
  refresh(courseId);
  return { ok: true };
}

export async function deleteModule(courseId: string, moduleId: string): Promise<Result> {
  const { supabase } = await ctx();
  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);
  if (count) return { ok: false, error: "Sposta o elimina prima le lezioni di questo modulo." };
  const { error } = await supabase
    .from("modules")
    .delete()
    .eq("id", moduleId)
    .eq("course_id", courseId);
  if (error) return { ok: false, error: GENERIC };
  refresh(courseId);
  return { ok: true };
}

export async function createLesson(
  courseId: string,
  moduleId: string,
  titolo: string,
): Promise<Result> {
  const { supabase } = await ctx();
  const t = titolo.trim();
  if (t.length < 2) return { ok: false, error: "Dai un titolo alla lezione." };
  const slug = await freeSlug(t, async (s) => {
    const { count } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("slug", s);
    return (count ?? 0) > 0;
  });
  const { data: last } = await supabase
    .from("lessons")
    .select("ordine")
    .eq("module_id", moduleId)
    .order("ordine", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("lessons").insert({
    module_id: moduleId,
    course_id: courseId,
    titolo: t.slice(0, 160),
    slug,
    ordine: (last?.ordine ?? 0) + 1,
  });
  if (error) return { ok: false, error: GENERIC };
  refresh(courseId);
  return { ok: true };
}

const orderSchema = z.array(z.object({ id: uuid, lessons: z.array(uuid) })).max(200);

/** Salva l'ordine di moduli e lezioni (anche lezioni spostate da un modulo all'altro). */
export async function saveProgramOrder(courseId: string, input: unknown): Promise<Result> {
  const { supabase } = await ctx();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ordine non valido." };
  const updates: PromiseLike<{ error: unknown }>[] = [];
  parsed.data.forEach((m, mi) => {
    updates.push(
      supabase
        .from("modules")
        .update({ ordine: mi + 1 })
        .eq("id", m.id)
        .eq("course_id", courseId),
    );
    m.lessons.forEach((lid, li) =>
      updates.push(
        supabase
          .from("lessons")
          .update({ module_id: m.id, ordine: li + 1 })
          .eq("id", lid)
          .eq("course_id", courseId),
      ),
    );
  });
  const results = await Promise.all(updates);
  if (results.some((r) => r.error))
    return { ok: false, error: "Ordine salvato solo in parte: ricarica la pagina e riprova." };
  refresh(courseId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lezione
// ---------------------------------------------------------------------------

const lessonSchema = z.object({
  id: uuid,
  courseId: uuid,
  titolo: z.string().trim().min(2, "Il titolo è troppo corto.").max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo lettere minuscole, numeri e trattini.")
    .max(80),
  descrizione: z.string().trim().max(20000),
  is_free_preview: z.boolean(),
});

export async function updateLesson(_p: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await ctx();
  const parsed = lessonSchema.safeParse({
    ...Object.fromEntries(formData),
    is_free_preview: formData.get("is_free_preview") === "on",
  });
  if (!parsed.success)
    return { ok: false, error: "Controlla i campi evidenziati.", fields: fieldsOf(parsed.error) };
  const d = parsed.data;
  const { data: clash } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", d.courseId)
    .eq("slug", d.slug)
    .neq("id", d.id)
    .maybeSingle();
  if (clash)
    return {
      ok: false,
      error: "Controlla i campi evidenziati.",
      fields: { slug: "Un'altra lezione del corso usa già questo indirizzo." },
    };
  const { error } = await supabase
    .from("lessons")
    .update({
      titolo: d.titolo,
      slug: d.slug,
      descrizione: d.descrizione || null,
      is_free_preview: d.is_free_preview,
    })
    .eq("id", d.id);
  if (error) return { ok: false, error: GENERIC };
  refresh(d.courseId);
  return { ok: true, message: "Lezione salvata." };
}

export async function deleteLesson(courseId: string, lessonId: string): Promise<Result> {
  const { supabase } = await ctx();
  const { data: l } = await supabase
    .from("lessons")
    .select("bunny_video_id, lesson_resources(storage_path)")
    .eq("id", lessonId)
    .maybeSingle();
  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", lessonId)
    .eq("course_id", courseId);
  if (error) return { ok: false, error: GENERIC };
  const row = l as {
    bunny_video_id: string | null;
    lesson_resources: { storage_path: string }[];
  } | null;
  if (row?.bunny_video_id) await deleteBunnyVideo(row.bunny_video_id);
  const paths = (row?.lesson_resources ?? []).map((r) => r.storage_path);
  if (paths.length) await supabase.storage.from("materiali").remove(paths);
  refresh(courseId);
  redirect(`/admin/corsi/${courseId}`);
}

export async function addResource(
  courseId: string,
  lessonId: string,
  file: { nome: string; tipo: string; storage_path: string; dimensione_bytes: number },
): Promise<Result> {
  const { tenant, supabase } = await ctx();
  if (!file.storage_path.startsWith(`${tenant.id}/${courseId}/${lessonId}/`))
    return { ok: false, error: "Percorso non valido." };
  const { data: last } = await supabase
    .from("lesson_resources")
    .select("ordine")
    .eq("lesson_id", lessonId)
    .order("ordine", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("lesson_resources").insert({
    lesson_id: lessonId,
    nome: file.nome.slice(0, 200),
    tipo: file.tipo.slice(0, 20) || "file",
    storage_path: file.storage_path,
    dimensione_bytes: Math.max(0, Math.round(file.dimensione_bytes)),
    ordine: (last?.ordine ?? 0) + 1,
  });
  if (error) return { ok: false, error: GENERIC };
  refresh(courseId);
  return { ok: true };
}

export async function deleteResource(courseId: string, resourceId: string): Promise<Result> {
  const { supabase } = await ctx();
  const { data } = await supabase
    .from("lesson_resources")
    .select("storage_path")
    .eq("id", resourceId)
    .maybeSingle();
  const { error } = await supabase.from("lesson_resources").delete().eq("id", resourceId);
  if (error) return { ok: false, error: GENERIC };
  if (data?.storage_path) await supabase.storage.from("materiali").remove([data.storage_path]);
  refresh(courseId);
  return { ok: true };
}
