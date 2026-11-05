import "server-only";

import { localParts, nextFreeSlot, PUBLISH_HANDOFF_MINUTES } from "@nexora/shared";

import { createAdminClient } from "@/lib/supabase/admin";

/** Anticipo minimo per programmare o spostare un post (dopo, il video è già in consegna). */
export const MIN_LEAD_MINUTES = PUBLISH_HANDOFF_MINUTES + 5;

async function enqueuePublish(workspaceId: string, videoId: string, at: Date) {
  const runAfter = new Date(at.getTime() - PUBLISH_HANDOFF_MINUTES * 60000);
  await createAdminClient().rpc("enqueue_job", {
    p_type: "publish",
    p_workspace_id: workspaceId,
    p_payload: { video_id: videoId, phase: "handoff", scheduled_at: at.toISOString() },
    p_dedupe_key: `publish:${videoId}:${at.toISOString()}`,
    p_run_after: (runAfter.getTime() < Date.now() ? new Date() : runAfter).toISOString(),
  });
}

/** Giorni (locali) già occupati da altri video programmati o pubblicati da oggi in poi. */
async function takenDays(workspaceId: string, timeZone: string, exceptVideoId?: string) {
  const { data } = await createAdminClient()
    .from("scheduled_posts")
    .select("video_id, scheduled_at")
    .eq("workspace_id", workspaceId)
    .in("status", ["scheduled", "publishing", "published"])
    .gte("scheduled_at", new Date(Date.now() - 24 * 3600e3).toISOString());
  return [...new Set((data ?? []).filter((p) => p.video_id !== exceptVideoId).map((p) => localParts(new Date(p.scheduled_at), timeZone).date))];
}

export type ScheduleResult = { at: Date } | { needsSocial: true } | { error: string };

/**
 * Programma un video approvato nel primo spazio libero (giorni e orario preferiti),
 * su tutti i social collegati e attivi. Niente viene programmato senza approvazione
 * (lo garantisce anche un trigger nel database).
 */
export async function autoSchedule(videoId: string): Promise<ScheduleResult> {
  const admin = createAdminClient();
  const { data: video } = await admin.from("videos").select("id, workspace_id, status").eq("id", videoId).single();
  if (!video || video.status !== "approved") return { error: "Il video non è approvato." };
  const { data: ws } = await admin
    .from("workspaces")
    .select("posting_days, posting_time, timezone")
    .eq("id", video.workspace_id)
    .single();
  const { data: accounts } = await admin
    .from("social_accounts")
    .select("id")
    .eq("workspace_id", video.workspace_id)
    .eq("status", "connected")
    .eq("enabled", true);
  if (!accounts?.length) return { needsSocial: true };

  const tz = ws?.timezone ?? "Europe/Rome";
  const at = nextFreeSlot({
    postingDays: ws?.posting_days ?? [1, 3, 5],
    postingTime: ws?.posting_time ?? "12:30",
    timeZone: tz,
    after: new Date(),
    takenDays: await takenDays(video.workspace_id, tz),
    minLeadMinutes: 60,
  });
  if (!at) return { error: "Nessuno spazio libero nei prossimi due mesi." };

  const { error } = await admin.from("scheduled_posts").upsert(
    accounts.map((a) => ({
      video_id: video.id,
      workspace_id: video.workspace_id,
      social_account_id: a.id,
      scheduled_at: at.toISOString(),
      status: "scheduled" as const,
    })),
    { onConflict: "video_id,social_account_id" },
  );
  if (error) return { error: "Programmazione non riuscita." };
  await admin.from("videos").update({ status: "scheduled" }).eq("id", video.id);
  await enqueuePublish(video.workspace_id, video.id, at);
  return { at };
}

/** Sposta tutti i post di un video a una nuova data/ora (finché non sono in consegna). */
export async function moveVideoTo(videoId: string, at: Date): Promise<{ ok: true } | { error: string }> {
  if (at.getTime() < Date.now() + MIN_LEAD_MINUTES * 60000) {
    return { error: `Scegli un orario ad almeno ${MIN_LEAD_MINUTES} minuti da adesso.` };
  }
  const admin = createAdminClient();
  const { data: posts } = await admin.from("scheduled_posts").select("id, status, workspace_id").eq("video_id", videoId).neq("status", "canceled");
  if (!posts?.length) return { error: "Il video non è in calendario." };
  if (posts.some((p) => p.status !== "scheduled")) return { error: "Il video è già in pubblicazione: non si può più spostare." };
  await admin.from("scheduled_posts").update({ scheduled_at: at.toISOString() }).eq("video_id", videoId).eq("status", "scheduled");
  await enqueuePublish(posts[0]!.workspace_id, videoId, at);
  return { ok: true };
}

/** Toglie il video dal calendario (torna "approvato"). */
export async function unscheduleVideo(videoId: string): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  const { data: posts } = await admin.from("scheduled_posts").select("status").eq("video_id", videoId);
  if (posts?.some((p) => p.status === "publishing")) return { error: "Il video è già in pubblicazione." };
  await admin.from("scheduled_posts").delete().eq("video_id", videoId).eq("status", "scheduled");
  await admin.from("videos").update({ status: "approved" }).eq("id", videoId).eq("status", "scheduled");
  return { ok: true };
}
