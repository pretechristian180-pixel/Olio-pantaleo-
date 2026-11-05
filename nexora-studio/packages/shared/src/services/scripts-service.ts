import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "../database.types.js";
import type { EditStyle, ProviderCost } from "../domain.js";
import type { LLMProvider } from "../providers/llm.js";
import { generateWeeklyScripts, regenerateScript } from "../scripts/generate.js";
import type { BrandContext, PastScript } from "../scripts/prompt.js";
import type { ScriptDraft } from "../scripts/schema.js";

/** Client Supabase con service role (bypassa la RLS): solo worker e codice server. */
export type AdminDb = SupabaseClient<Database>;

export const HISTORY_WEEKS = 8;

export async function recordCosts(
  db: AdminDb,
  costs: ProviderCost[],
  ctx: { workspaceId: string | null; jobId?: string | null; videoId?: string | null; operation: string },
) {
  if (costs.length === 0) return;
  const { error } = await db.from("provider_costs").insert(
    costs.map((c) => ({
      workspace_id: ctx.workspaceId,
      job_id: ctx.jobId ?? null,
      video_id: ctx.videoId ?? null,
      operation: ctx.operation,
      provider: c.provider,
      model: c.model ?? null,
      cost_usd: c.costUsd,
      units: (c.units ?? {}) as Json,
    })),
  );
  if (error) console.error(JSON.stringify({ msg: "costi non registrati", error: error.message }));
}

export async function loadBrandContext(db: AdminDb, workspaceId: string): Promise<BrandContext> {
  const [{ data: ws, error }, { data: brand }] = await Promise.all([
    db.from("workspaces").select("name, sector, city").eq("id", workspaceId).single(),
    db.from("brand_profiles").select("*").eq("workspace_id", workspaceId).maybeSingle(),
  ]);
  if (error || !ws) throw new Error(`Azienda ${workspaceId} non trovata`);
  return {
    companyName: ws.name,
    sector: ws.sector,
    city: ws.city,
    toneOfVoice: brand?.tone_of_voice ?? null,
    targetAudience: brand?.target_audience ?? null,
    services: brand?.services ?? null,
    doNotSay: brand?.do_not_say ?? null,
    editStyle: (brand?.edit_style ?? {}) as EditStyle,
  };
}

/** Script delle ultime `weeks` settimane prima di `weekStart` (per l'anti-ripetizione). */
export async function loadPastScripts(
  db: AdminDb,
  workspaceId: string,
  weekStart: string,
  weeks = HISTORY_WEEKS,
): Promise<PastScript[]> {
  const from = new Date(`${weekStart}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - weeks * 7);
  const { data: batches } = await db
    .from("script_batches")
    .select("id, week_start")
    .eq("workspace_id", workspaceId)
    .gte("week_start", from.toISOString().slice(0, 10))
    .lt("week_start", weekStart);
  if (!batches?.length) return [];
  const weekOf = new Map(batches.map((b) => [b.id, b.week_start]));
  const { data: scripts } = await db
    .from("scripts")
    .select("batch_id, title, hook, topic_tags")
    .in(
      "batch_id",
      batches.map((b) => b.id),
    );
  return (scripts ?? [])
    .map((s) => ({
      weekStart: weekOf.get(s.batch_id) ?? "",
      title: s.title,
      hook: s.hook,
      topicTags: s.topic_tags,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Quanti script preparare: la frequenza scelta, ma mai più dei video ancora disponibili.
 * Prova gratuita: al massimo i video di prova rimasti. Abbonamento non attivo (pagamento
 * fallito, disdetto): nessuno script, finché non torna attivo.
 */
export function scriptQuota(ws: {
  posts_per_week: number;
  plan_id: string | null;
  trial_videos_left: number;
  subscription_status: string;
}) {
  if (!ws.plan_id) return Math.max(0, Math.min(ws.posts_per_week, ws.trial_videos_left));
  if (ws.subscription_status !== "active") return 0;
  return ws.posts_per_week;
}

function toRow(d: ScriptDraft, batchId: string, workspaceId: string, position: number) {
  return {
    batch_id: batchId,
    workspace_id: workspaceId,
    position,
    title: d.title,
    hook: d.hook,
    body: d.body,
    call_to_action: d.call_to_action,
    shooting_notes: d.shooting_notes as unknown as Json,
    format: d.format,
    topic_tags: d.topic_tags,
  };
}

/**
 * Genera e salva gli script di una settimana. Idempotente: se la settimana ha già script, non
 * richiama l'AI (un job ripetuto dopo un errore non produce doppioni né costi doppi).
 */
export async function generateScriptsForWeek(
  db: AdminDb,
  llm: LLMProvider,
  args: { workspaceId: string; weekStart: string; jobId?: string | null },
): Promise<{ batchId: string | null; created: number; skipped?: string }> {
  const { data: ws, error } = await db
    .from("workspaces")
    .select("id, posts_per_week, plan_id, trial_videos_left, subscription_status, onboarding_completed_at")
    .eq("id", args.workspaceId)
    .single();
  if (error || !ws) throw new Error(`Azienda ${args.workspaceId} non trovata`);
  if (!ws.onboarding_completed_at) return { batchId: null, created: 0, skipped: "onboarding non completato" };

  const count = scriptQuota(ws);
  if (count === 0) return { batchId: null, created: 0, skipped: "nessun video disponibile nel piano" };

  const { data: batch, error: batchError } = await db
    .from("script_batches")
    .upsert({ workspace_id: ws.id, week_start: args.weekStart }, { onConflict: "workspace_id,week_start", ignoreDuplicates: false })
    .select("id")
    .single();
  if (batchError || !batch) throw new Error(`Settimana non creata: ${batchError?.message}`);

  const { count: existing } = await db
    .from("scripts")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batch.id);
  if ((existing ?? 0) > 0) return { batchId: batch.id, created: 0, skipped: "script già presenti" };

  const [brand, past] = await Promise.all([
    loadBrandContext(db, ws.id),
    loadPastScripts(db, ws.id, args.weekStart),
  ]);

  const result = await generateWeeklyScripts(llm, { brand, weekStart: args.weekStart, count, past });
  await recordCosts(db, result.costs, { workspaceId: ws.id, jobId: args.jobId, operation: "generate_scripts" });

  const { error: insertError } = await db
    .from("scripts")
    .insert(result.value.map((d, i) => toRow(d, batch.id, ws.id, i)));
  if (insertError) throw new Error(`Script non salvati: ${insertError.message}`);

  return { batchId: batch.id, created: result.value.length };
}

/**
 * Riscrive uno script esistente (chiamata dal server dopo il controllo di appartenenza e il
 * consumo di una rigenerazione).
 */
export async function regenerateScriptById(
  db: AdminDb,
  llm: LLMProvider,
  args: { scriptId: string; feedback?: string },
) {
  const { data: script, error } = await db.from("scripts").select("*").eq("id", args.scriptId).single();
  if (error || !script) throw new Error("Script non trovato");
  const { data: batch } = await db
    .from("script_batches")
    .select("week_start")
    .eq("id", script.batch_id)
    .single();
  const weekStart = batch!.week_start;

  const [brand, past, { data: siblings }] = await Promise.all([
    loadBrandContext(db, script.workspace_id),
    loadPastScripts(db, script.workspace_id, weekStart),
    db.from("scripts").select("title, hook").eq("batch_id", script.batch_id).neq("id", script.id),
  ]);

  const result = await regenerateScript(llm, {
    brand,
    weekStart,
    current: { title: script.title, hook: script.hook, format: script.format },
    siblings: siblings ?? [],
    past,
    feedback: args.feedback,
  });
  await recordCosts(db, result.costs, { workspaceId: script.workspace_id, operation: "regenerate_script" });

  const d = result.value;
  const { error: updateError } = await db
    .from("scripts")
    .update({
      title: d.title,
      hook: d.hook,
      body: d.body,
      call_to_action: d.call_to_action,
      shooting_notes: d.shooting_notes as unknown as Json,
      format: d.format,
      topic_tags: d.topic_tags,
      status: "to_shoot",
      regenerated: script.regenerated + 1,
    })
    .eq("id", script.id);
  if (updateError) throw new Error(`Script non aggiornato: ${updateError.message}`);
  return d;
}
