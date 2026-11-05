import {
  type AdminDb,
  brandedEmail,
  generateScriptsForWeek,
  getEmailProvider,
  type LLMProvider,
  weeklyScriptsEmail,
} from "@nexora/shared/server";
import type { Tables } from "@nexora/shared";

import type { WorkerConfig } from "./config.js";
import { log } from "./log.js";
import { publishJob, syncSocialJob } from "./pipeline/publish.js";
import { retentionJob } from "./pipeline/retention.js";
import { editJob, renderJob, transcribeJob } from "./pipeline/video.js";

export type Job = Tables<"jobs">;

export interface HandlerDeps {
  db: AdminDb;
  llm: () => LLMProvider;
  config: WorkerConfig;
}

function payloadOf(job: Job) {
  return (job.payload ?? {}) as Record<string, unknown>;
}

async function generateScripts(job: Job, deps: HandlerDeps) {
  const week = String(payloadOf(job).week_start ?? "");
  if (!job.workspace_id || !/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error("Payload non valido");
  const result = await generateScriptsForWeek(deps.db, deps.llm(), {
    workspaceId: job.workspace_id,
    weekStart: week,
    jobId: job.id,
  });
  log("info", "script generati", { job: job.id, workspace: job.workspace_id, week, ...result });
}

/** Email e nomi dei membri di un'azienda (dati di auth: solo con service role). */
async function memberRecipients(db: AdminDb, workspaceId: string) {
  const { data: members } = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await db.from("profiles").select("user_id, full_name").in("user_id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));
  const out: { email: string; firstName: string | null }[] = [];
  for (const id of ids) {
    const { data } = await db.auth.admin.getUserById(id);
    if (data.user?.email) {
      out.push({ email: data.user.email, firstName: names.get(id)?.split(/\s+/)[0] ?? null });
    }
  }
  return out;
}

async function sendWeeklyScripts(job: Job, deps: HandlerDeps) {
  const batchId = String(payloadOf(job).batch_id ?? "");
  const { data: batch } = await deps.db.from("script_batches").select("*").eq("id", batchId).maybeSingle();
  if (!batch) throw new Error("Settimana non trovata");
  if (batch.notified_at) return log("info", "email già inviata", { batch: batch.id });

  const [{ data: ws }, { data: scripts }, recipients] = await Promise.all([
    deps.db.from("workspaces").select("name").eq("id", batch.workspace_id).single(),
    deps.db.from("scripts").select("id, title, hook, format").eq("batch_id", batch.id).order("position"),
    memberRecipients(deps.db, batch.workspace_id),
  ]);
  if (!scripts?.length) throw new Error("Nessuno script da inviare");

  const email = getEmailProvider();
  if (email.name === "disabled") {
    log("warn", "email disattivate (RESEND_API_KEY mancante): email del lunedì non inviata", { batch: batch.id });
    return;
  }

  let sent = 0;
  for (const r of recipients) {
    const msg = weeklyScriptsEmail({
      firstName: r.firstName,
      companyName: ws?.name ?? "la tua azienda",
      appUrl: deps.config.appUrl,
      scripts,
    });
    const res = await email.send({ to: r.email, subject: msg.subject, html: msg.html, text: msg.text });
    if (res.sent) sent++;
  }
  if (sent === 0 && recipients.length > 0) throw new Error("Nessuna email inviata");

  await deps.db
    .from("script_batches")
    .update({ notified_at: new Date().toISOString(), status: "sent" })
    .eq("id", batch.id);
  log("info", "email della settimana inviata", { batch: batch.id, recipients: sent });
}

export async function handleJob(job: Job, deps: HandlerDeps) {
  switch (job.type) {
    case "generate_scripts":
      return generateScripts(job, deps);
    case "send_email": {
      const kind = payloadOf(job).kind;
      if (kind === "weekly_scripts") return sendWeeklyScripts(job, deps);
      throw new Error(`Tipo di email sconosciuto: ${String(kind)}`);
    }
    case "transcribe":
      return transcribeJob(job, deps);
    case "edit":
      return editJob(job, deps);
    case "render":
      return renderJob(job, deps);
    case "publish":
      return publishJob(job, deps);
    case "sync_social":
      return syncSocialJob(job, deps);
    case "retention":
      await retentionJob(job, deps);
      return;
    default:
      throw new Error(`Tipo di job non gestito in questa fase: ${job.type}`);
  }
}

/** Avviso al team Nexora quando un job fallisce definitivamente. */
export async function alertAdmins(job: Job, error: string, deps: HandlerDeps) {
  log("error", "job fallito definitivamente", { job: job.id, type: job.type, workspace: job.workspace_id, error });
  if (!deps.config.adminAlertEmail) return;
  const { html, text } = brandedEmail({
    title: `Job fallito: ${job.type}`,
    intro: `Il job ${job.id} (azienda ${job.workspace_id ?? "n/d"}) è fallito dopo ${job.attempts} tentativi. Ultimo errore: ${error.slice(0, 300)}`,
    ctaLabel: "Apri l'area admin",
    ctaUrl: `${deps.config.appUrl}/admin`,
  });
  await getEmailProvider().send({
    to: deps.config.adminAlertEmail,
    subject: `[Nexora Studio] Job fallito: ${job.type}`,
    html,
    text,
  });
}
