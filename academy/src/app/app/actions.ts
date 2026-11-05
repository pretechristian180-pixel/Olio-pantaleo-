"use server";

import { revalidatePath } from "next/cache";
import { afterLessonCompleted } from "@/lib/certificates";
import { requireUser } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  answerSchema,
  fieldErrors,
  noteSchema,
  profileSchema,
  questionSchema,
} from "@/lib/validation";

export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: string; fields?: Record<string, string> };

const GENERIC = "Non siamo riusciti a salvare. Controlla la connessione e riprova.";

export async function markLessonComplete(
  lessonId: string,
  completata = true,
): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: prev } = await supabase
    .from("lesson_progress")
    .select("ultimo_secondo, secondi_visti")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  const { error } = await supabase.from("lesson_progress").upsert({
    user_id: user.id,
    lesson_id: lessonId,
    ultimo_secondo: prev?.ultimo_secondo ?? 0,
    secondi_visti: prev?.secondi_visti ?? 0,
    completata,
    completata_il: completata ? new Date().toISOString() : null,
  });
  if (error) return { ok: false, error: "Non abbiamo potuto segnare la lezione. Riprova." };
  if (completata) await afterLessonCompleted(lessonId, user.email);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function saveNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  const { lessonId, noteId, secondo, testo } = parsed.data;
  const supabase = await createClient();
  const query = noteId
    ? supabase
        .from("notes")
        .update({ testo })
        .eq("id", noteId)
        .eq("user_id", user.id)
        .select("id")
        .single()
    : supabase.from("notes").insert({ lesson_id: lessonId, secondo, testo }).select("id").single();
  const { data, error } = await query;
  if (error || !data) return { ok: false, error: GENERIC };
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", noteId).eq("user_id", user.id);
  if (error) return { ok: false, error: "Non abbiamo potuto eliminare la nota." };
  return { ok: true };
}

export async function askQuestion(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .insert({ lesson_id: parsed.data.lessonId, testo: parsed.data.testo });
  if (error) return { ok: false, error: "Puoi fare domande solo sui corsi a cui sei iscritto." };
  revalidatePath("/app/corsi", "layout");
  return { ok: true };
}

export async function answerQuestion(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  const supabase = await createClient();
  const { error } = await supabase
    .from("answers")
    .insert({ question_id: parsed.data.questionId, testo: parsed.data.testo });
  if (error) return { ok: false, error: GENERIC };
  revalidatePath("/app/corsi", "layout");
  return { ok: true };
}

export async function updateProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/app/profilo");
  const parsed = profileSchema.safeParse({
    nome: formData.get("nome"),
    cognome: formData.get("cognome") ?? "",
    marketing: formData.get("marketing") === "on",
  });
  if (!parsed.success)
    return {
      ok: false,
      error: "Controlla i campi evidenziati.",
      fields: fieldErrors(parsed.error),
    };
  const { nome, cognome, marketing } = parsed.data;
  const supabase = await createClient();
  const tenant = await getCurrentTenant();
  const { error: errProfilo } = await supabase
    .from("profiles")
    .update({ nome, cognome })
    .eq("id", user.id);
  // Il consenso marketing vale per questa academy, non per tutte.
  const cambiaConsenso = marketing !== (user.membership?.consenso_marketing ?? false);
  const { error: errConsenso } =
    tenant && cambiaConsenso
      ? await supabase
          .from("memberships")
          .update({
            consenso_marketing: marketing,
            consenso_marketing_il: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("tenant_id", tenant.id)
      : { error: null };
  if (errProfilo || errConsenso) return { ok: false, error: GENERIC };
  revalidatePath("/app", "layout");
  return { ok: true };
}
