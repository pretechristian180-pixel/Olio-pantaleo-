import type { SocialPlatform } from "@nexora/shared";
import {
  type AdminDb,
  brandedEmail,
  createPublishingProvider,
  enforceSocialLimit,
  getEmailProvider,
  type PublishingProvider,
  recordCosts,
} from "@nexora/shared/server";

import type { HandlerDeps, Job } from "../handlers.js";
import { log } from "../log.js";
import { PermanentError } from "./video.js";

let provider: PublishingProvider | null | undefined;
function publishing() {
  if (provider === undefined) provider = createPublishingProvider();
  return provider;
}

function payload(job: Job) {
  return (job.payload ?? {}) as Record<string, unknown>;
}

/** Per quanto tempo dopo l'orario si continua a verificare (ogni 5 minuti) prima di dare errore. */
const CHECK_WINDOW_MS = 60 * 60000;

/**
 * Job "publish":
 * - fase "handoff" (15 min prima): consegna il video a Metricool con l'orario esatto;
 * - fase "check" (dopo l'orario): verifica l'esito per ogni social.
 * Un job il cui orario non coincide più con il calendario (video spostato) non fa nulla.
 */
export async function publishJob(job: Job, deps: HandlerDeps) {
  const p = payload(job);
  return p.phase === "check" ? checkPublication(job, deps) : handoff(job, deps);
}

async function handoff(job: Job, deps: HandlerDeps) {
  const p = payload(job);
  const videoId = String(p.video_id);
  const { data: video } = await deps.db.from("videos").select("*").eq("id", videoId).single();
  if (!video || video.status !== "scheduled") return log("info", "pubblicazione non più necessaria", { video: videoId });

  const { data: posts } = await deps.db
    .from("scheduled_posts")
    .select("*, account:social_accounts(platform, enabled, status)")
    .eq("video_id", videoId)
    .eq("status", "scheduled");
  const due = (posts ?? []).filter((x) => new Date(x.scheduled_at).toISOString() === new Date(String(p.scheduled_at)).toISOString());
  if (!due.length) return log("info", "orario cambiato: job superato", { video: videoId });

  const active = due.filter((x) => {
    const a = x.account as { enabled: boolean; status: string } | null;
    return a?.enabled && a.status === "connected";
  });
  const skipped = due.filter((x) => !active.includes(x));
  if (skipped.length) {
    await deps.db
      .from("scheduled_posts")
      .update({ status: "canceled", error: "Social non più collegato o escluso" })
      .in("id", skipped.map((x) => x.id));
  }
  if (!active.length) throw new PermanentError("Nessun social collegato per pubblicare il video");

  const prov = publishing();
  if (!prov) throw new PermanentError("Pubblicazione non configurata (Metricool)");
  const { data: ws } = await deps.db.from("workspaces").select("name, timezone, metricool_blog_id").eq("id", video.workspace_id).single();
  if (!ws?.metricool_blog_id && prov.name !== "demo") throw new PermanentError("Brand Metricool non collegato all'azienda");

  const { data: version } = await deps.db
    .from("video_versions")
    .select("output_path, thumbnail_path")
    .eq("video_id", videoId)
    .eq("version", video.current_version)
    .single();
  if (!version?.output_path) throw new PermanentError("Video montato non trovato");
  const sign = async (path: string | null) =>
    path ? ((await deps.db.storage.from("output").createSignedUrl(path, 48 * 3600)).data?.signedUrl ?? null) : null;
  const videoUrl = await sign(version.output_path);
  if (!videoUrl) throw new Error("Link al video non creato");

  const { data: script } = video.script_id
    ? await deps.db.from("scripts").select("title").eq("id", video.script_id).single()
    : { data: null };
  const scheduledAt = new Date(String(p.scheduled_at));
  const publishAt = new Date(Math.max(scheduledAt.getTime(), Date.now() + 5 * 60000));
  const platforms = active.map((x) => (x.account as { platform: SocialPlatform }).platform);

  const res = await prov.schedule({
    brandRef: ws?.metricool_blog_id ?? `demo-${video.workspace_id.slice(0, 8)}`,
    platforms,
    videoUrl,
    thumbnailUrl: await sign(version.thumbnail_path),
    caption: video.caption ?? "",
    hashtags: video.hashtags,
    title: script?.title ?? ws?.name ?? "Video",
    publishAt,
    timezone: ws?.timezone ?? "Europe/Rome",
  });
  if (res.cost) await recordCosts(deps.db, [res.cost], { workspaceId: video.workspace_id, jobId: job.id, videoId, operation: "publish" });

  await deps.db
    .from("scheduled_posts")
    .update({ status: "publishing", provider_post_id: res.providerPostId, error: null })
    .in("id", active.map((x) => x.id));
  await deps.db.rpc("enqueue_job", {
    p_type: "publish",
    p_workspace_id: video.workspace_id,
    p_payload: { video_id: videoId, phase: "check", provider_post_id: res.providerPostId, publish_at: publishAt.toISOString() },
    p_dedupe_key: `publish-check:${videoId}:${res.providerPostId}`,
    p_run_after: new Date(publishAt.getTime() + 3 * 60000).toISOString(),
  });
  log("info", "video consegnato per la pubblicazione", { video: videoId, platforms, publishAt });
}

async function checkPublication(job: Job, deps: HandlerDeps) {
  const p = payload(job);
  const videoId = String(p.video_id);
  const postId = String(p.provider_post_id);
  const prov = publishing();
  if (!prov) throw new PermanentError("Pubblicazione non configurata (Metricool)");
  const { data: video } = await deps.db.from("videos").select("workspace_id").eq("id", videoId).single();
  const { data: ws } = await deps.db.from("workspaces").select("timezone, metricool_blog_id").eq("id", video!.workspace_id).single();
  const status = await prov.status(
    ws?.metricool_blog_id ?? `demo-${video!.workspace_id.slice(0, 8)}`,
    postId,
    new Date(String(p.publish_at)),
    ws?.timezone ?? "Europe/Rome",
  );

  const { data: posts } = await deps.db
    .from("scheduled_posts")
    .select("id, account:social_accounts(platform)")
    .eq("video_id", videoId)
    .eq("provider_post_id", postId)
    .eq("status", "publishing");
  let pending = 0;
  for (const post of posts ?? []) {
    const platform = (post.account as { platform: string } | null)?.platform;
    const net = status.networks.find((n) => n.platform === platform);
    if (!net || net.status === "pending") {
      pending++;
      continue;
    }
    await deps.db
      .from("scheduled_posts")
      .update(
        net.status === "published"
          ? { status: "published", permalink: net.url ?? null, published_at: new Date().toISOString(), error: null }
          : { status: "failed", error: net.error ?? "Pubblicazione non riuscita" },
      )
      .eq("id", post.id);
  }
  if (pending) {
    const publishAt = new Date(String(p.publish_at)).getTime();
    if (Date.now() > publishAt + CHECK_WINDOW_MS) {
      throw new PermanentError(`${pending} social non risultano pubblicati dopo un'ora`);
    }
    // Nuova verifica tra 5 minuti (job nuovo: questo si chiude senza consumare tentativi)
    const n = Number(p.check_n ?? 0) + 1;
    await deps.db.rpc("enqueue_job", {
      p_type: "publish",
      p_workspace_id: video!.workspace_id,
      p_payload: { ...p, check_n: n },
      p_dedupe_key: `publish-check:${videoId}:${postId}:${n}`,
      p_run_after: new Date(Date.now() + 5 * 60000).toISOString(),
    });
    return log("info", "pubblicazione in corso, nuova verifica tra 5 minuti", { video: videoId, pending });
  }
  await finalizeVideo(deps, videoId);
}

/** Stato finale del video e avviso se qualche social non è andato. */
async function finalizeVideo(deps: HandlerDeps, videoId: string) {
  const { data: posts } = await deps.db
    .from("scheduled_posts")
    .select("status, error, account:social_accounts(platform)")
    .eq("video_id", videoId)
    .in("status", ["published", "failed"]);
  const published = (posts ?? []).filter((x) => x.status === "published");
  const failed = (posts ?? []).filter((x) => x.status === "failed");
  const { data: video } = await deps.db
    .from("videos")
    .update({ status: published.length ? "published" : "approved" })
    .eq("id", videoId)
    .select("workspace_id")
    .single();
  log("info", "pubblicazione verificata", { video: videoId, published: published.length, failed: failed.length });
  if (failed.length && video) {
    await notifyFailure(deps, video.workspace_id, videoId, failed.map((f) => (f.account as { platform: string } | null)?.platform ?? "social"));
  }
}

async function notifyFailure(deps: HandlerDeps, workspaceId: string, videoId: string, platforms: string[]) {
  const email = getEmailProvider();
  const { html, text } = brandedEmail({
    title: "Un post non è stato pubblicato",
    intro: `Non siamo riusciti a pubblicare il video su ${platforms.join(", ")} dopo 3 tentativi. Di solito succede quando il collegamento al social è scaduto.`,
    ctaLabel: "Controlla i social collegati",
    ctaUrl: `${deps.config.appUrl}/social`,
    outro: "Dalla pagina del video puoi riprogrammarlo con un tocco.",
  });
  const { data: members } = await deps.db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId);
  for (const m of members ?? []) {
    const { data } = await deps.db.auth.admin.getUserById(m.user_id);
    if (data.user?.email) await email.send({ to: data.user.email, subject: "Pubblicazione non riuscita", html, text });
  }
  void videoId;
}

/** Fallimento definitivo di un job di pubblicazione: post in errore e avviso all'azienda. */
export async function onPublishJobFailed(job: Job, deps: HandlerDeps, error: string) {
  const p = payload(job);
  const videoId = String(p.video_id);
  const filter = deps.db.from("scheduled_posts").update({ status: "failed", error: error.slice(0, 500) }).eq("video_id", videoId);
  await (p.phase === "check" ? filter.eq("status", "publishing") : filter.eq("status", "scheduled"));
  await finalizeVideo(deps, videoId);
}

/** Job "sync_social": aggiorna i social collegati leggendo il brand Metricool dell'azienda. */
export async function syncSocialJob(job: Job, deps: HandlerDeps) {
  const workspaceId = String(payload(job).workspace_id ?? job.workspace_id);
  const prov = publishing();
  if (!prov) return log("warn", "sincronizzazione social saltata: Metricool non configurato");
  const { data: ws } = await deps.db.from("workspaces").select("metricool_blog_id").eq("id", workspaceId).single();
  const brandRef = ws?.metricool_blog_id ?? (prov.name === "demo" ? `demo-${workspaceId.slice(0, 8)}` : null);
  if (!brandRef) return;
  const accounts = await prov.listAccounts(brandRef);
  const now = new Date().toISOString();
  const { data: existing } = await deps.db.from("social_accounts").select("id, platform").eq("workspace_id", workspaceId);
  for (const a of accounts) {
    const found = existing?.find((e) => e.platform === a.platform);
    if (found) {
      await deps.db
        .from("social_accounts")
        .update({ handle: a.handle, provider_account_id: a.providerAccountId, status: "connected", last_checked_at: now })
        .eq("id", found.id);
    } else {
      await deps.db.from("social_accounts").insert({
        workspace_id: workspaceId,
        platform: a.platform,
        handle: a.handle,
        provider_account_id: a.providerAccountId,
        last_checked_at: now,
      });
    }
  }
  const connected = new Set(accounts.map((a) => a.platform));
  for (const e of existing ?? []) {
    if (!connected.has(e.platform as SocialPlatform)) {
      await deps.db.from("social_accounts").update({ status: "disconnected", last_checked_at: now }).eq("id", e.id);
    }
  }
  const excluded = await enforceSocialLimit(deps.db, workspaceId);
  log("info", "social sincronizzati", { workspace: workspaceId, connected: [...connected], excluded });
}

export async function enqueueHourlySync(db: AdminDb, now = new Date()) {
  const { data } = await db.from("workspaces").select("id").not("metricool_blog_id", "is", null);
  const hour = now.toISOString().slice(0, 13);
  for (const w of data ?? []) {
    await db.rpc("enqueue_job", {
      p_type: "sync_social",
      p_workspace_id: w.id,
      p_payload: { workspace_id: w.id },
      p_dedupe_key: `sync_social:${w.id}:${hour}`,
    });
  }
}
