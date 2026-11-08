"use server";

import { zonedToUtc } from "@nexora/shared";
import { brandedEmail, getEmailProvider, socialLimit } from "@nexora/shared/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { publicEnv } from "@/lib/env";
import { autoSchedule, moveVideoTo, unscheduleVideo } from "@/lib/scheduling";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertMember, getSessionContext } from "@/lib/workspace";

async function ownVideo(videoId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select("id, workspace_id, status")
    .eq("id", videoId)
    .maybeSingle();
  if (!data) throw new Error("Video non trovato.");
  const { ctx } = await assertMember(data.workspace_id);
  return { video: data, ctx };
}

function refresh(videoId?: string) {
  revalidatePath("/calendario");
  revalidatePath("/inizio");
  revalidatePath("/video");
  if (videoId) revalidatePath(`/video/${videoId}`);
}

export type CalendarActionResult = { ok?: boolean; error?: string; message?: string };

/** Sposta un video (trascinamento nel calendario o "Sposta"). Data e ora in fuso dell'azienda. */
export async function moveVideoAction(
  videoId: string,
  date: string,
  time: string,
): Promise<CalendarActionResult> {
  try {
    const { video } = await ownVideo(videoId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
      return { error: "Data o ora non valide." };
    const { data: ws } = await createAdminClient()
      .from("workspaces")
      .select("timezone")
      .eq("id", video.workspace_id)
      .single();
    const at = zonedToUtc(date, time, ws?.timezone ?? "Europe/Rome");
    if (video.status === "approved") {
      const res = await autoSchedule(videoId);
      if ("needsSocial" in res)
        return { error: "Collega almeno un social per programmare i video." };
      if ("error" in res) return { error: res.error };
    }
    const res = await moveVideoTo(videoId, at);
    refresh(videoId);
    return "error" in res ? { error: res.error } : { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Operazione non riuscita." };
  }
}

/** Programma un video approvato nel primo spazio libero. */
export async function scheduleVideoAction(fd: FormData) {
  const { video } = await ownVideo(String(fd.get("video_id")));
  await autoSchedule(video.id);
  refresh(video.id);
}

export async function unscheduleVideoAction(fd: FormData) {
  const { video } = await ownVideo(String(fd.get("video_id")));
  await unscheduleVideo(video.id);
  refresh(video.id);
}

/** Includi o escludi un social dalla pubblicazione (per tutti i prossimi video). */
export async function toggleSocialAction(fd: FormData) {
  const supabase = await createClient();
  const id = String(fd.get("account_id"));
  const { data: account } = await supabase
    .from("social_accounts")
    .select("id, workspace_id, enabled")
    .eq("id", id)
    .maybeSingle();
  if (!account) return;
  await assertMember(account.workspace_id, "owner");
  const admin = createAdminClient();
  if (!account.enabled) {
    const limit = await socialLimit(admin, account.workspace_id);
    const { count } = await admin
      .from("social_accounts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", account.workspace_id)
      .eq("status", "connected")
      .eq("enabled", true);
    if (limit !== null && (count ?? 0) >= limit) {
      redirect(`/social?limite=${limit}`);
    }
  }
  await admin.from("social_accounts").update({ enabled: !account.enabled }).eq("id", id);
  revalidatePath("/social");
}

/** Aggiorna i social collegati leggendoli da Metricool (lo fa il worker in pochi secondi). */
export async function refreshSocialAction(fd: FormData) {
  const workspaceId = String(fd.get("workspace_id"));
  await assertMember(workspaceId);
  await createAdminClient().rpc("enqueue_job", {
    p_type: "sync_social",
    p_workspace_id: workspaceId,
    p_payload: { workspace_id: workspaceId },
    p_dedupe_key: `sync_social:${workspaceId}:manual:${new Date().toISOString().slice(0, 16)}`,
  });
  revalidatePath("/social");
}

/** Il link per collegare i social è scaduto o manca: avvisa il team CP Studio. */
export async function requestConnectLinkAction(fd: FormData): Promise<void> {
  const workspaceId = String(fd.get("workspace_id"));
  const { membership } = await assertMember(workspaceId);
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (to) {
    const { html, text } = brandedEmail({
      title: "Link per collegare i social richiesto",
      intro: `${membership.workspace.name} chiede un nuovo link per collegare i social (Metricool → brand → Connessioni → Crea link).`,
      ctaLabel: "Apri la configurazione social",
      ctaUrl: `${publicEnv.appUrl}/admin/social`,
    });
    await getEmailProvider().send({
      to,
      subject: `[Christian Prete Studio] Link social per ${membership.workspace.name}`,
      html,
      text,
    });
  }
  revalidatePath("/social");
}

/** Team CP Studio: collega l'azienda al suo brand Metricool e salva il link di collegamento. */
export async function adminSetMetricool(fd: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.profile?.is_admin) throw new Error("Solo il team CP Studio.");
  const workspaceId = String(fd.get("workspace_id"));
  const blogId = String(fd.get("blog_id") ?? "").trim() || null;
  const link = String(fd.get("connect_url") ?? "").trim() || null;
  if (link && !/^https:\/\//.test(link)) throw new Error("Il link deve iniziare con https://");
  const admin = createAdminClient();
  await admin
    .from("workspaces")
    .update({
      metricool_blog_id: blogId,
      metricool_connect_url: link,
      metricool_connect_expires: link ? new Date(Date.now() + 71 * 3600e3).toISOString() : null,
    })
    .eq("id", workspaceId);
  if (blogId) {
    await admin.rpc("enqueue_job", {
      p_type: "sync_social",
      p_workspace_id: workspaceId,
      p_payload: { workspace_id: workspaceId },
      p_dedupe_key: `sync_social:${workspaceId}:admin:${Date.now()}`,
    });
  }
  revalidatePath("/admin/social");
}
