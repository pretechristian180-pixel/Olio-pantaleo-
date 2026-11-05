import { type AdminDb, brandedEmail, getEmailProvider } from "@nexora/shared/server";

import type { HandlerDeps, Job } from "../handlers.js";
import { log } from "../log.js";

/** Termini art. 6.4 e accordo sul trattamento dei dati. */
export const RAW_RETENTION_DAYS = 90;
export const CONTENT_RETENTION_DAYS = 30;
export const PURGE_WARNING_DAYS = 7;

const DAY = 86400e3;
const BUCKETS = ["raw", "output", "brand"] as const;
const BUSY = ["queued", "editing", "changes_requested"];

const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

/** Job notturno: girati oltre i 90 giorni e contenuti delle aziende cessate da oltre 30 giorni. */
export async function retentionJob(_job: Job, deps: HandlerDeps, now = new Date()) {
  const raw = await purgeOldRawUploads(deps.db, now);
  const content = await purgeCeasedWorkspaces(deps, now);
  log("info", "conservazione dei dati", { rawPurged: raw, ...content });
  return { rawPurged: raw, ...content };
}

/** Girato originale e trascrizione cancellati 90 giorni dopo il caricamento. Il video finito resta. */
export async function purgeOldRawUploads(db: AdminDb, now: Date) {
  const cutoff = new Date(now.getTime() - RAW_RETENTION_DAYS * DAY).toISOString();
  const { data: rows } = await db
    .from("raw_uploads")
    .select("id, workspace_id, storage_path, video:videos(status)")
    .is("purged_at", null)
    .lt("created_at", cutoff)
    .limit(500);
  // Non si tocca un girato mentre il suo video è in montaggio.
  const due = (rows ?? []).filter((r) => {
    const v = (Array.isArray(r.video) ? r.video[0] : r.video) as { status: string } | null | undefined;
    return !v || !BUSY.includes(v.status);
  });
  for (let i = 0; i < due.length; i += 100) {
    const chunk = due.slice(i, i + 100);
    const { error } = await db.storage.from("raw").remove(chunk.map((r) => r.storage_path));
    if (error) throw new Error(`Cancellazione girati non riuscita: ${error.message}`);
    await db
      .from("raw_uploads")
      .update({ purged_at: now.toISOString(), transcript: null })
      .in("id", chunk.map((r) => r.id));
  }
  const perWorkspace = new Map<string, number>();
  for (const r of due) perWorkspace.set(r.workspace_id, (perWorkspace.get(r.workspace_id) ?? 0) + 1);
  for (const [workspaceId, count] of perWorkspace) {
    await db.from("audit_log").insert({ workspace_id: workspaceId, action: "retention.raw_purged", details: { count, days: RAW_RETENTION_DAYS } });
  }
  return due.length;
}

/** Tutti i file di un'azienda in un bucket (percorsi "<workspace_id>/…", anche in sottocartelle). */
async function listAll(db: AdminDb, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`Elenco file non riuscito (${bucket}): ${error.message}`);
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.id) out.push(path);
      else out.push(...(await listAll(db, bucket, path)));
    }
    if ((data ?? []).length < 1000) return out;
  }
}

async function ownerEmails(db: AdminDb, workspaceId: string) {
  const { data: owners } = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("role", "owner");
  const emails: string[] = [];
  for (const o of owners ?? []) {
    const { data } = await db.auth.admin.getUserById(o.user_id);
    if (data.user?.email) emails.push(data.user.email);
  }
  return emails;
}

/**
 * Aziende con abbonamento chiuso: avviso 7 giorni prima, poi cancellazione dei contenuti
 * 30 giorni dopo la fine del periodo pagato. Restano account, fatturazione e registro attività.
 */
export async function purgeCeasedWorkspaces(deps: HandlerDeps, now: Date) {
  const db = deps.db;
  // Chi si è riabbonato riparte da zero: un'eventuale nuova cessazione avrà un nuovo avviso.
  await db.from("workspaces").update({ content_purge_warned_at: null }).neq("subscription_status", "canceled").not("content_purge_warned_at", "is", null);

  const warnFrom = new Date(now.getTime() - (CONTENT_RETENTION_DAYS - PURGE_WARNING_DAYS) * DAY).toISOString();
  const { data: ceased } = await db
    .from("workspaces")
    .select("id, name, period_end, content_purge_warned_at")
    .eq("subscription_status", "canceled")
    .is("content_purged_at", null)
    .not("period_end", "is", null)
    .lt("period_end", warnFrom)
    .limit(100);

  let warned = 0;
  let purged = 0;
  for (const ws of ceased ?? []) {
    const deadline = new Date(new Date(ws.period_end!).getTime() + CONTENT_RETENTION_DAYS * DAY);
    if (!ws.content_purge_warned_at) {
      // Almeno 7 giorni di preavviso, anche se l'avviso parte in ritardo.
      const effective = new Date(Math.max(deadline.getTime(), now.getTime() + PURGE_WARNING_DAYS * DAY));
      const mail = brandedEmail({
        title: "Scarica i tuoi video",
        intro: `L'abbonamento di ${ws.name} è chiuso. I video, i girati e gli script restano disponibili fino al ${dateFmt.format(effective)}: dopo verranno cancellati, come previsto dai Termini di servizio.`,
        ctaLabel: "Vai ai tuoi video",
        ctaUrl: `${deps.config.appUrl}/video`,
        outro: "Se riattivi un piano prima di quella data non perdi nulla.",
      });
      const email = getEmailProvider();
      for (const to of await ownerEmails(db, ws.id)) {
        await email.send({ to, subject: `I video di ${ws.name} restano disponibili fino al ${dateFmt.format(effective)}`, ...mail }).catch(() => undefined);
      }
      await db.from("workspaces").update({ content_purge_warned_at: now.toISOString() }).eq("id", ws.id);
      await db.from("audit_log").insert({ workspace_id: ws.id, action: "retention.purge_warned", details: { deadline: effective.toISOString() } });
      warned++;
      continue;
    }
    const warnedAt = new Date(ws.content_purge_warned_at).getTime();
    if (now < deadline || now.getTime() - warnedAt < PURGE_WARNING_DAYS * DAY) continue;
    await purgeWorkspaceContent(db, ws.id, now);
    purged++;
  }
  return { warned, purged };
}

/** Cancella file e contenuti di un'azienda. Restano account, membri, fatturazione e registro. */
export async function purgeWorkspaceContent(db: AdminDb, workspaceId: string, now = new Date()) {
  let files = 0;
  for (const bucket of BUCKETS) {
    const paths = await listAll(db, bucket, workspaceId);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await db.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) throw new Error(`Cancellazione file non riuscita (${bucket}): ${error.message}`);
    }
    files += paths.length;
  }
  // Video (con versioni, richieste di modifica e post), girati, script.
  const steps = [
    db.from("videos").delete().eq("workspace_id", workspaceId),
    db.from("raw_uploads").delete().eq("workspace_id", workspaceId),
    db.from("scripts").delete().eq("workspace_id", workspaceId),
    db.from("script_batches").delete().eq("workspace_id", workspaceId),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) throw new Error(`Cancellazione contenuti non riuscita: ${error.message}`);
  }
  await db
    .from("brand_profiles")
    .update({ tone_of_voice: null, target_audience: null, services: null, do_not_say: null, reference_videos: [] })
    .eq("workspace_id", workspaceId);
  await db.from("workspaces").update({ logo_url: null, content_purged_at: now.toISOString() }).eq("id", workspaceId);
  await db.from("audit_log").insert({ workspace_id: workspaceId, action: "retention.content_purged", details: { files } });
  log("info", "contenuti dell'azienda cancellati", { workspace: workspaceId, files });
}
