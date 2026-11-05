import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { certificateIssued } from "@/lib/email-templates";
import { originFromHost } from "@/lib/billing";
import { getCurrentTenant, requestHost } from "@/lib/tenant";

export type ClaimResult =
  | { stato: "rilasciato"; codice: string; nuovo: boolean }
  | { stato: "non_completato" }
  | { stato: "nome_mancante" };

/** Rilascia l'attestato se il corso è completato (idempotente: la seconda volta lo restituisce). */
export async function claimCertificate(courseId: string): Promise<ClaimResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_certificate", { p_course: courseId });
  if (error) {
    if (error.code === "P0001") return { stato: "nome_mancante" };
    return { stato: "non_completato" };
  }
  const row = (data as { codice: string; nuovo: boolean }[] | null)?.[0];
  return row
    ? { stato: "rilasciato", codice: row.codice, nuovo: row.nuovo }
    : { stato: "non_completato" };
}

/**
 * Dopo una lezione completata: se era l'ultima, rilascia l'attestato e manda l'email.
 * Non blocca mai il salvataggio dell'avanzamento.
 */
export async function afterLessonCompleted(lessonId: string, email: string) {
  try {
    const supabase = await createClient();
    const { data: lesson } = await supabase
      .from("lessons")
      .select("course_id, courses(titolo)")
      .eq("id", lessonId)
      .maybeSingle();
    if (!lesson) return;
    const res = await claimCertificate(lesson.course_id as string);
    if (res.stato !== "rilasciato" || !res.nuovo) return;
    const [tenant, origin] = await Promise.all([
      getCurrentTenant(),
      requestHost().then(originFromHost),
    ]);
    if (!tenant || !origin) return;
    const corso = (lesson.courses as unknown as { titolo: string } | null)?.titolo ?? "il corso";
    await sendEmail({
      to: email,
      fromName: tenant.nome,
      content: certificateIssued({
        brand: { nome: tenant.nome, colore: tenant.brand.primary },
        corso,
        codice: res.codice,
        url: `${origin}/app/attestati`,
        pdfUrl: `${origin}/attestati/${res.codice}/pdf`,
      }),
      idempotencyKey: `attestato-${res.codice}`,
    });
  } catch (e) {
    console.error("Attestato", e);
  }
}
