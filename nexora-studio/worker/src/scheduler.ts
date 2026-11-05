import { type AdminDb, scriptQuota } from "@nexora/shared/server";

import type { WorkerConfig } from "./config.js";
import { log } from "./log.js";
import { addDays, romeNow, targetWeeks, weeklyEmailDue } from "./rome-time.js";

/**
 * Pianificazione idempotente, eseguita ogni minuto:
 * - genera gli script della settimana in corso (aziende nuove o riattivate) e, da domenica sera,
 *   di quella successiva;
 * - dal lunedì mattina accoda l'email degli script per le settimane non ancora notificate.
 * Le chiavi di deduplica evitano doppioni anche con più worker o dopo un riavvio.
 */
export async function runScheduler(db: AdminDb, config: WorkerConfig, now = new Date()) {
  const { data: workspaces, error } = await db
    .from("workspaces")
    .select("id, posts_per_week, plan_id, trial_videos_left, subscription_status")
    .not("onboarding_completed_at", "is", null);
  if (error) throw new Error(`Scheduler: ${error.message}`);

  const active = (workspaces ?? []).filter((w) => scriptQuota(w) > 0);
  const weeks = targetWeeks(now, config.generateHour);
  const r = romeNow(now);
  // Per le email guardiamo anche la settimana in corso nel fine settimana (es. generata venerdì).
  const currentMonday = addDays(r.date, -(r.isoDow - 1));
  const emailWeeks = [...new Set([currentMonday, ...weeks])];
  let enqueued = 0;

  for (const ws of active) {
    for (const week of weeks) {
      const { error: e } = await db.rpc("enqueue_job", {
        p_type: "generate_scripts",
        p_workspace_id: ws.id,
        p_payload: { week_start: week },
        p_dedupe_key: `generate_scripts:${ws.id}:${week}`,
      });
      if (e) log("error", "accodamento non riuscito", { workspace: ws.id, error: e.message });
      else enqueued++;
    }
  }

  // Email: settimane già iniziate (o lunedì dopo l'ora stabilita) con script e non notificate.
  const { data: batches } = await db
    .from("script_batches")
    .select("id, workspace_id, week_start")
    .is("notified_at", null)
    .in("week_start", emailWeeks);
  for (const b of batches ?? []) {
    if (!weeklyEmailDue(now, b.week_start, config.emailHour)) continue;
    const { count } = await db.from("scripts").select("id", { count: "exact", head: true }).eq("batch_id", b.id);
    if (!count) continue;
    await db.rpc("enqueue_job", {
      p_type: "send_email",
      p_workspace_id: b.workspace_id,
      p_payload: { kind: "weekly_scripts", batch_id: b.id },
      p_dedupe_key: `weekly_email:${b.id}`,
    });
  }

  return { activeWorkspaces: active.length, weeks, checked: enqueued };
}
