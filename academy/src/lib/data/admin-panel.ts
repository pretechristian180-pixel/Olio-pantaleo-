import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";

/** Dati del pannello admin. Le funzioni del database controllano che chi chiede sia staff. */

export type Overview = {
  vendite_mese_cents: number;
  ordini_mese: number;
  vendite_totali_cents: number;
  studenti_totali: number;
  studenti_attivi: number;
  completamento_medio: number | null;
  domande_aperte: number;
  lezione_abbandoni: string | null;
  lezione_abbandoni_corso: string | null;
};

async function tenantId() {
  const t = await getCurrentTenant();
  if (!t) throw new Error("Academy non trovata");
  return t.id;
}

export async function getOverview(): Promise<Overview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview", { p_tenant: await tenantId() });
  if (error) throw new Error(`Numeri non disponibili: ${error.message}`);
  return (data as Overview[])[0]!;
}

export type StudentRow = {
  user_id: string;
  nome: string | null;
  cognome: string | null;
  email: string;
  ruolo: "student" | "instructor" | "admin";
  iscritto_il: string;
  ultima_attivita: string | null;
  corsi: number;
  completamento: number | null;
  consenso_marketing: boolean;
};

export async function getStudents(cerca?: string): Promise<StudentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_students", {
    p_tenant: await tenantId(),
    p_cerca: cerca?.slice(0, 100) || null,
  });
  if (error) throw new Error(`Studenti non disponibili: ${error.message}`);
  return (data ?? []) as StudentRow[];
}

export type StudentCourse = {
  course_id: string;
  titolo: string;
  fonte: "stripe" | "manuale" | "azienda" | "abbonamento";
  iscritto_il: string;
  lezioni: number;
  completate: number;
};

export async function getStudentCourses(userId: string): Promise<StudentCourse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_student_courses", {
    p_tenant: await tenantId(),
    p_user: userId,
  });
  if (error) throw new Error(`Corsi dello studente non disponibili: ${error.message}`);
  return (data ?? []) as StudentCourse[];
}

export type OrderRow = {
  id: string;
  email: string | null;
  importo_cents: number;
  valuta: string;
  stato: "in_attesa" | "pagato" | "rimborsato" | "fallito";
  creato_il: string;
  pagato_il: string | null;
  corso: string | null;
};

export async function getOrders(limit = 300): Promise<OrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, email, importo_cents, valuta, stato, creato_il, pagato_il, courses(titolo)")
    .eq("tenant_id", await tenantId())
    .neq("stato", "in_attesa")
    .order("creato_il", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Vendite non disponibili: ${error.message}`);
  return (data ?? []).map((o) => {
    const { courses, ...rest } = o as typeof o & { courses: { titolo: string } | null };
    return { ...rest, corso: courses?.titolo ?? null } as OrderRow;
  });
}

export type QuestionRow = {
  id: string;
  testo: string;
  stato: "aperta" | "risposta" | "chiusa";
  creato_il: string;
  autore: string;
  corso: string;
  corso_slug: string;
  lezione: string;
  lezione_slug: string;
  risposte: number;
};

export type AnswerRow = {
  id: string;
  question_id: string;
  testo: string;
  is_docente: boolean;
  creato_il: string;
};

export async function getQuestions(soloAperte: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_questions", {
    p_tenant: await tenantId(),
    p_stato: soloAperte ? "aperta" : null,
  });
  if (error) throw new Error(`Domande non disponibili: ${error.message}`);
  const questions = (data ?? []) as QuestionRow[];
  const ids = questions.filter((q) => q.risposte > 0).map((q) => q.id);
  let answers: AnswerRow[] = [];
  if (ids.length) {
    const { data: a } = await supabase
      .from("answers")
      .select("id, question_id, testo, is_docente, creato_il")
      .in("question_id", ids)
      .order("creato_il");
    answers = (a ?? []) as AnswerRow[];
  }
  return questions.map((q) => ({ ...q, answers: answers.filter((a) => a.question_id === q.id) }));
}

export async function getCourseOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, titolo")
    .eq("tenant_id", await tenantId())
    .order("ordine");
  return (data ?? []) as { id: string; titolo: string }[];
}
