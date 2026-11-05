"use server";

import { brandedEmail, getEmailProvider } from "@nexora/shared/server";
import { revalidatePath } from "next/cache";

import type { FormState } from "@/components/forms/form-message";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { autoSchedule } from "@/lib/scheduling";
import { MAX_CHANGE_ROUNDS } from "@/lib/videos";
import { assertMember, getSessionContext } from "@/lib/workspace";

const MAX_BYTES = 2 * 1024 * 1024 * 1024;

function str(fd: FormData, key: string, max = 2000) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export type RegisterResult = { videoId?: string; error?: string };

/**
 * Registra un girato appena caricato nello storage e avvia il montaggio.
 * Consuma un video della prova gratuita (restituito se il montaggio fallisce).
 */
export async function registerUpload(input: {
  workspaceId: string;
  storagePath: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  scriptId: string | null;
}): Promise<RegisterResult> {
  const { ctx } = await assertMember(input.workspaceId);
  if (!input.storagePath.startsWith(`${input.workspaceId}/`))
    return { error: "Percorso del file non valido." };
  if (input.sizeBytes > MAX_BYTES) return { error: "Il file supera i 2 GB." };

  const supabase = await createClient();
  let scriptId: string | null = null;
  if (input.scriptId) {
    const { data: script } = await supabase
      .from("scripts")
      .select("id, workspace_id")
      .eq("id", input.scriptId)
      .maybeSingle();
    if (script?.workspace_id === input.workspaceId) scriptId = script.id;
  }

  const { data: raw, error: rawError } = await supabase
    .from("raw_uploads")
    .insert({
      workspace_id: input.workspaceId,
      script_id: scriptId,
      uploaded_by: ctx.user.id,
      storage_path: input.storagePath,
      file_name: input.fileName.slice(0, 200),
      size_bytes: input.sizeBytes,
      mime_type: input.mimeType.slice(0, 100),
      source: "upload",
    })
    .select("id")
    .single();
  if (rawError || !raw) return { error: "Non siamo riusciti a registrare il video. Riprova." };

  const admin = createAdminClient();
  const { data: quota } = await admin.rpc("reserve_video", { p_workspace_id: input.workspaceId });
  const q = (quota ?? {}) as {
    ok?: boolean;
    reason?: string;
    kind?: "trial" | "plan";
    period_start?: string;
    limit?: number;
  };
  if (!q.ok) return { error: quotaMessage(q.reason, q.limit) };

  const { data: video, error: videoError } = await admin
    .from("videos")
    .insert({
      workspace_id: input.workspaceId,
      script_id: scriptId,
      raw_upload_id: raw.id,
      status: "queued",
      quota_kind: q.kind ?? null,
      billed_period_start: q.period_start ?? null,
    })
    .select("id")
    .single();
  if (videoError || !video) {
    await admin.rpc("release_reservation", {
      p_workspace_id: input.workspaceId,
      p_period_start: q.period_start ?? null,
    });
    return { error: "Non siamo riusciti ad avviare il montaggio. Riprova." };
  }

  await admin.rpc("enqueue_job", {
    p_type: "transcribe",
    p_workspace_id: input.workspaceId,
    p_payload: { video_id: video.id },
    p_dedupe_key: `transcribe:${video.id}`,
  });
  if (scriptId) await supabase.from("scripts").update({ status: "uploaded" }).eq("id", scriptId);

  revalidatePath("/video");
  revalidatePath("/inizio");
  revalidatePath("/script", "layout");
  return { videoId: video.id };
}

async function loadVideoForAction(videoId: string) {
  const supabase = await createClient();
  const { data: video } = await supabase.from("videos").select("*").eq("id", videoId).maybeSingle();
  if (!video) throw new Error("Video non trovato.");
  const { ctx } = await assertMember(video.workspace_id);
  return { video, ctx };
}

/** Approva il video (niente viene mai pubblicato senza questo passaggio). */
export async function approveVideo(fd: FormData) {
  const { video, ctx } = await loadVideoForAction(str(fd, "video_id"));
  if (video.status !== "review") return;
  const { data: approved } = await createAdminClient()
    .from("videos")
    .update({ status: "approved", approved_by: ctx.user.id, approved_at: new Date().toISOString() })
    .eq("id", video.id)
    .eq("status", "review")
    .select("id");
  // Entra subito nel calendario, nel primo spazio libero (se ci sono social collegati).
  if (approved?.length) await autoSchedule(video.id);
  revalidatePath("/calendario");
  revalidatePath(`/video/${video.id}`);
  revalidatePath("/video");
  revalidatePath("/inizio");
}

/** Richiesta di modifica in testo libero: diventa un nuovo montaggio (max 2 giri). */
export async function requestChanges(_prev: FormState, fd: FormData): Promise<FormState> {
  let loaded;
  try {
    loaded = await loadVideoForAction(str(fd, "video_id"));
  } catch {
    return { error: "Video non trovato." };
  }
  const { video, ctx } = loaded;
  const message = str(fd, "message", 1000);
  if (message.length < 3) return { fieldErrors: { message: "Scrivi cosa vuoi cambiare." } };
  if (video.status !== "review")
    return { error: "Puoi chiedere modifiche solo a un video da approvare." };
  if (video.change_rounds_used >= MAX_CHANGE_ROUNDS) {
    return { error: "Hai già usato i 2 giri di modifiche inclusi per questo video." };
  }

  const admin = createAdminClient();
  // Aggiornamento condizionato: due clic veloci non consumano due giri.
  const { data: updated } = await admin
    .from("videos")
    .update({
      status: "changes_requested",
      change_rounds_used: video.change_rounds_used + 1,
      error: null,
    })
    .eq("id", video.id)
    .eq("status", "review")
    .eq("change_rounds_used", video.change_rounds_used)
    .select("id");
  if (!updated?.length) return { error: "Il video è cambiato nel frattempo: ricarica la pagina." };

  const { data: fb } = await admin
    .from("video_feedback")
    .insert({ video_id: video.id, version: video.current_version, user_id: ctx.user.id, message })
    .select("id")
    .single();
  await admin.rpc("enqueue_job", {
    p_type: "edit",
    p_workspace_id: video.workspace_id,
    p_payload: { video_id: video.id, feedback_id: fb!.id },
    p_dedupe_key: `edit:${video.id}:fb:${fb!.id}`,
  });

  revalidatePath(`/video/${video.id}`);
  revalidatePath("/video");
  return { success: "Richiesta inviata: stiamo preparando la nuova versione." };
}

/** Didascalia e hashtag modificabili finché il video non è pubblicato. */
export async function updateCaption(_prev: FormState, fd: FormData): Promise<FormState> {
  let loaded;
  try {
    loaded = await loadVideoForAction(str(fd, "video_id"));
  } catch {
    return { error: "Video non trovato." };
  }
  const { video } = loaded;
  if (!["review", "approved", "scheduled"].includes(video.status)) {
    return { error: "La didascalia non è modificabile in questo momento." };
  }
  const caption = str(fd, "caption", 2200);
  const hashtags = str(fd, "hashtags", 600)
    .split(/[\s,]+/)
    .map((h) => h.replace(/^#/, "").replace(/[^\p{L}\p{N}_]/gu, ""))
    .filter(Boolean)
    .slice(0, 15);
  await createAdminClient().from("videos").update({ caption, hashtags }).eq("id", video.id);
  revalidatePath(`/video/${video.id}`);
  return { success: "Didascalia salvata." };
}

// ─────────────────────────────────────────────────────────────────────────
// Team Nexora (admin)
// ─────────────────────────────────────────────────────────────────────────
async function assertAdmin() {
  const ctx = await getSessionContext();
  if (!ctx?.profile?.is_admin) throw new Error("Solo il team Nexora.");
  return ctx;
}

/** Revisione interna superata: il video passa al cliente, con email. */
export async function adminSendToClient(fd: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const videoId = str(fd, "video_id");
  const { data: video } = await admin
    .from("videos")
    .update({ status: "review" })
    .eq("id", videoId)
    .eq("status", "internal_review")
    .select("id, workspace_id")
    .maybeSingle();
  if (video) {
    const { data: ws } = await admin
      .from("workspaces")
      .select("name")
      .eq("id", video.workspace_id)
      .single();
    const { data: members } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", video.workspace_id);
    const email = getEmailProvider();
    const { html, text } = brandedEmail({
      title: "Il tuo video è pronto",
      intro: `Abbiamo montato un nuovo video per ${ws?.name ?? "la tua azienda"}. Guardalo e approvalo: poi lo programmiamo sui tuoi social.`,
      ctaLabel: "Guarda e approva",
      ctaUrl: `${publicEnv.appUrl}/video/${video.id}`,
      outro:
        "Se qualcosa non ti convince puoi chiedere una modifica a parole tue: sono inclusi 2 giri di modifiche.",
    });
    for (const m of members ?? []) {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      if (data.user?.email)
        await email.send({
          to: data.user.email,
          subject: "Il tuo video è pronto da approvare",
          html,
          text,
        });
    }
  }
  revalidatePath("/admin/revisione");
}

/** Il team chiede un nuovo montaggio prima di mostrarlo al cliente (non consuma i giri del cliente). */
export async function adminRequestRework(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await assertAdmin();
  const admin = createAdminClient();
  const videoId = str(fd, "video_id");
  const message = str(fd, "message", 1000);
  if (message.length < 3) return { fieldErrors: { message: "Scrivi cosa cambiare." } };
  const { data: video } = await admin
    .from("videos")
    .update({ status: "changes_requested" })
    .eq("id", videoId)
    .eq("status", "internal_review")
    .select("id, workspace_id, current_version")
    .maybeSingle();
  if (!video) return { error: "Il video non è più in revisione." };
  const { data: fb } = await admin
    .from("video_feedback")
    .insert({
      video_id: video.id,
      version: video.current_version,
      user_id: ctx.user.id,
      message: `[Team Nexora] ${message}`,
    })
    .select("id")
    .single();
  await admin.rpc("enqueue_job", {
    p_type: "edit",
    p_workspace_id: video.workspace_id,
    p_payload: { video_id: video.id, feedback_id: fb!.id },
    p_dedupe_key: `edit:${video.id}:fb:${fb!.id}`,
  });
  revalidatePath("/admin/revisione");
  return { success: "Nuovo montaggio richiesto." };
}

/** Messaggio per un montaggio non consentito dal piano. */
function quotaMessage(reason?: string, limit?: number) {
  switch (reason) {
    case "trial_over":
      return "Hai usato i 3 video della prova gratuita. Scegli un piano per continuare.";
    case "payment_failed":
      return "L'ultimo pagamento non è andato a buon fine: aggiorna la carta in Piano e fatturazione per riprendere i montaggi. I tuoi video restano tutti al loro posto.";
    case "limit_reached":
      return `Hai montato i ${limit ?? ""} video del mese previsti dal tuo piano. Passa a un piano superiore o aspetta il rinnovo.`.replace(
        "i  video",
        "i video",
      );
    default:
      return "L'abbonamento non è attivo: riattivalo in Piano e fatturazione per caricare nuovi video.";
  }
}
