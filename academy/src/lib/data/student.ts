import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCourseBySlug, type Course } from "@/lib/data/courses";
import { lessonEyebrow, type OutlineLesson } from "@/lib/course-outline";
import { nextLessonToWatch } from "@/lib/progress";
import { percent } from "@/lib/utils";
import type { CourseProgress } from "@/components/dashboard/course-progress-card";
import type { ResumeLesson } from "@/components/dashboard/resume-card";

export type ProgressMap = Map<
  string,
  { ultimo_secondo: number; secondi_visti: number; completata: boolean; aggiornato_il: string }
>;

type EnrollmentRow = { course_id: string; courses: { slug: string } | null };

export const getMyProgress = cache(async (userId: string): Promise<ProgressMap> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("lesson_id, ultimo_secondo, secondi_visti, completata, aggiornato_il")
    .eq("user_id", userId)
    .order("aggiornato_il", { ascending: false });
  if (error) throw new Error(`Avanzamento non disponibile: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.lesson_id as string, r as never]));
});

export const getMyEnrolledSlugs = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("course_id, courses(slug)")
    .eq("user_id", userId)
    .or(`scade_il.is.null,scade_il.gt.${new Date().toISOString()}`)
    .order("creato_il", { ascending: false });
  if (error) throw new Error(`Iscrizioni non disponibili: ${error.message}`);
  return ((data ?? []) as unknown as EnrollmentRow[])
    .map((e) => e.courses?.slug)
    .filter((s): s is string => !!s);
});

function courseLessons(course: Course): OutlineLesson[] {
  return course.outline.moduli.flatMap((m) => m.lezioni);
}

export function coursePercent(course: Course, progress: ProgressMap) {
  const lezioni = courseLessons(course);
  return percent(lezioni.filter((l) => progress.get(l.id)?.completata).length, lezioni.length);
}

/** Tutto quello che serve alla dashboard, in poche query. */
export async function getDashboard(userId: string) {
  const supabase = await createClient();
  const [slugs, progress, certs] = await Promise.all([
    getMyEnrolledSlugs(userId),
    getMyProgress(userId),
    supabase.from("certificates").select("course_id").eq("user_id", userId),
  ]);
  const courses = (await Promise.all(slugs.map((s) => getCourseBySlug(s)))).filter(
    (c): c is Course => !!c,
  );
  const certSet = new Set((certs.data ?? []).map((c) => c.course_id as string));

  const cards: CourseProgress[] = courses.map((c) => ({
    slug: c.slug,
    titolo: c.titolo,
    copertinaUrl: c.copertinaUrl,
    moduli: c.outline.moduli.length,
    lezioni: c.outline.totaleLezioni,
    percent: coursePercent(c, progress),
    haAttestato: certSet.has(c.id),
  }));

  const resume = buildResume(courses, progress);
  const secondi = [...progress.values()].reduce((s, p) => s + p.secondi_visti, 0);

  return {
    cards,
    resume,
    numeri: {
      attivi: courses.length,
      completate: [...progress.values()].filter((p) => p.completata).length,
      ore: new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(secondi / 3600),
      attestati: certSet.size,
    },
  };
}

/** L'ultima lezione vista; se era finita, la successiva da fare nello stesso corso. */
function buildResume(courses: Course[], progress: ProgressMap): ResumeLesson | null {
  for (const [lessonId, p] of progress) {
    const course = courses.find((c) => courseLessons(c).some((l) => l.id === lessonId));
    if (!course) continue;
    const lezioni = courseLessons(course);
    const completed = new Set(
      lezioni.filter((l) => progress.get(l.id)?.completata).map((l) => l.id),
    );
    const target = p.completata
      ? nextLessonToWatch(lezioni, completed)
      : lezioni.find((l) => l.id === lessonId);
    if (!target) continue;
    return {
      courseTitolo: course.titolo,
      courseSlug: course.slug,
      lessonSlug: target.slug,
      lessonTitolo: target.titolo,
      eyebrow: lessonEyebrow(course.outline, target.slug) ?? "",
      ultimoSecondo:
        target.id === lessonId ? p.ultimo_secondo : (progress.get(target.id)?.ultimo_secondo ?? 0),
      durataSec: target.durataSec,
      percentCorso: percent(completed.size, lezioni.length),
    };
  }
  // Iscritto ma non ha ancora iniziato: proponi la prima lezione del corso più recente.
  const first = courses[0];
  const lesson = first ? courseLessons(first)[0] : undefined;
  if (!first || !lesson) return null;
  return {
    courseTitolo: first.titolo,
    courseSlug: first.slug,
    lessonSlug: lesson.slug,
    lessonTitolo: lesson.titolo,
    eyebrow: lessonEyebrow(first.outline, lesson.slug) ?? "",
    ultimoSecondo: 0,
    durataSec: lesson.durataSec,
    percentCorso: 0,
  };
}

export type LessonFull = {
  id: string;
  slug: string;
  titolo: string;
  descrizione: string | null;
  bunny_video_id: string | null;
  durata_sec: number;
  is_free_preview: boolean;
  module_id: string;
};

export type Resource = { id: string; nome: string; tipo: string; dimensione_bytes: number };
export type Note = { id: string; secondo: number; testo: string; aggiornato_il: string };
export type ThreadRow = {
  tipo: "domanda" | "risposta";
  id: string;
  question_id: string;
  autore: string;
  is_docente: boolean;
  is_mio: boolean;
  testo: string;
  stato: string | null;
  creato_il: string;
};

/** Dati della pagina lezione. lesson = null se l'utente non può vederla (RLS). */
export async function getLessonPage(userId: string, courseSlug: string, lessonSlug: string) {
  const course = await getCourseBySlug(courseSlug);
  if (!course) return null;
  const supabase = await createClient();
  const meta = courseLessons(course).find((l) => l.slug === lessonSlug);
  if (!meta) return null;

  const [{ data: lesson }, enrolledSlugs, progress] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, slug, titolo, descrizione, bunny_video_id, durata_sec, is_free_preview, module_id",
      )
      .eq("id", meta.id)
      .maybeSingle(),
    getMyEnrolledSlugs(userId),
    getMyProgress(userId),
  ]);
  const enrolled = enrolledSlugs.includes(course.slug);

  let resources: Resource[] = [];
  let notes: Note[] = [];
  let thread: ThreadRow[] = [];
  if (lesson) {
    const [r, n, t] = await Promise.all([
      supabase
        .from("lesson_resources")
        .select("id, nome, tipo, dimensione_bytes")
        .eq("lesson_id", lesson.id)
        .order("ordine"),
      supabase
        .from("notes")
        .select("id, secondo, testo, aggiornato_il")
        .eq("lesson_id", lesson.id)
        .order("secondo"),
      enrolled
        ? supabase.rpc("lesson_thread", { p_lesson_id: lesson.id })
        : Promise.resolve({ data: [] }),
    ]);
    resources = (r.data ?? []) as Resource[];
    notes = (n.data ?? []) as Note[];
    thread = (t.data ?? []) as ThreadRow[];
  }

  const lezioni = courseLessons(course);
  const idx = lezioni.findIndex((l) => l.id === meta.id);
  const modulo = course.outline.moduli.find((m) => m.lezioni.some((l) => l.id === meta.id))!;
  const moduloSuccessivo =
    course.outline.moduli.find((m) => m.numero === modulo.numero + 1) ?? null;

  return {
    course,
    lesson: lesson as LessonFull | null,
    meta,
    enrolled,
    progress,
    resources,
    notes,
    thread,
    modulo,
    moduloSuccessivo,
    eyebrow: lessonEyebrow(course.outline, meta.slug) ?? "",
    prev: idx > 0 ? lezioni[idx - 1]! : null,
    next: idx < lezioni.length - 1 ? lezioni[idx + 1]! : null,
    percentCorso: coursePercent(course, progress),
  };
}

/** Lezione da aprire con "Vai al corso". */
export async function getCourseEntryLesson(userId: string, courseSlug: string) {
  const course = await getCourseBySlug(courseSlug);
  if (!course) return null;
  const progress = await getMyProgress(userId);
  const lezioni = courseLessons(course);
  const completed = new Set(lezioni.filter((l) => progress.get(l.id)?.completata).map((l) => l.id));
  const ultima = lezioni
    .filter((l) => progress.has(l.id) && !progress.get(l.id)!.completata)
    .sort((a, b) =>
      progress.get(b.id)!.aggiornato_il.localeCompare(progress.get(a.id)!.aggiornato_il),
    )[0];
  return ultima ?? nextLessonToWatch(lezioni, completed);
}
