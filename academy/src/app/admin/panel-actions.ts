"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { answerNotification } from "@/lib/email-templates";
import { optionalServerEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, requestHost } from "@/lib/tenant";
import { originFromHost } from "@/lib/billing";

export type ActionState = null | { ok: true; message: string } | { ok: false; error: string };

const grantSchema = z.object({
  course_id: z.string().uuid("Scegli un corso."),
  email: z.string().trim().toLowerCase().email("Scrivi un'email valida."),
});

/** Accesso manuale a un corso: bonifico, omaggio, cliente aziendale. */
export async function grantAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = grantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_grant_access", {
    p_course: parsed.data.course_id,
    p_email: parsed.data.email,
  });
  if (error) return { ok: false, error: "Non è stato possibile dare l'accesso. Riprova." };
  if (data === "nessun_account")
    return {
      ok: false,
      error:
        "Nessun account con questa email. Chiedi alla persona di registrarsi sulla tua academy, poi riprova.",
    };
  revalidatePath("/admin/studenti");
  return { ok: true, message: `Accesso dato a ${parsed.data.email}.` };
}

/** Toglie l'accesso a un corso (le vendite restano nello storico). */
export async function revokeAccess(userId: string, courseId: string) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("enrollments").delete().eq("user_id", userId).eq("course_id", courseId);
  revalidatePath(`/admin/studenti/${userId}`);
}

const answerSchema = z.object({
  question_id: z.string().uuid(),
  testo: z.string().trim().min(2, "Scrivi la risposta.").max(6000, "Risposta troppo lunga."),
});

/** Risposta del docente: la domanda passa a "risposta" e lo studente riceve un'email. */
export async function answerQuestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff();
  const parsed = answerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("answers")
    .insert({ question_id: parsed.data.question_id, testo: parsed.data.testo });
  if (error) return { ok: false, error: "Risposta non salvata. Riprova." };
  const { data: q } = await supabase
    .from("questions")
    .update({ stato: "risposta" })
    .eq("id", parsed.data.question_id)
    .select("user_id, courses(titolo, slug), lessons(titolo, slug)")
    .single();
  await notifyStudent(q, parsed.data.testo).catch((e) => console.error("Email risposta", e));
  revalidatePath("/admin/domande");
  revalidatePath("/admin");
  return { ok: true, message: "Risposta pubblicata. Lo studente riceve un'email." };
}

export async function setQuestionStatus(questionId: string, stato: "aperta" | "chiusa") {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("questions").update({ stato }).eq("id", questionId);
  revalidatePath("/admin/domande");
  revalidatePath("/admin");
}

async function notifyStudent(
  q: {
    user_id: string;
    courses: unknown;
    lessons: unknown;
  } | null,
  testo: string,
) {
  if (!q || !optionalServerEnv("SUPABASE_SECRET_KEY")) return;
  const tenant = await getCurrentTenant();
  const origin = originFromHost(await requestHost());
  const course = q.courses as { titolo: string; slug: string } | null;
  const lesson = q.lessons as { titolo: string; slug: string } | null;
  if (!tenant || !origin || !course || !lesson) return;
  const { data } = await createAdminClient().auth.admin.getUserById(q.user_id);
  if (!data.user?.email) return;
  await sendEmail({
    to: data.user.email,
    fromName: tenant.nome,
    content: answerNotification({
      brand: { nome: tenant.nome, colore: tenant.brand.primary },
      lezione: lesson.titolo,
      risposta: testo,
      url: `${origin}/app/corsi/${course.slug}/${lesson.slug}`,
    }),
  });
}
