import "server-only";

import { firstScriptsWeek, type ShootingNotes, type Tables } from "@nexora/shared";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Script = Tables<"scripts"> & { shooting_notes: Partial<ShootingNotes> };
export type Batch = Tables<"script_batches">;
export type GenerationState = "queued" | "running" | "failed" | "done" | null;

export const MAX_REGENERATIONS = 3;

/** Settimane con script dell'azienda (più recenti prima). */
export async function listBatches(workspaceId: string, limit = 9) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("script_batches")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("week_start", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getBatchScripts(batchId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scripts")
    .select("*")
    .eq("batch_id", batchId)
    .order("position");
  return (data ?? []) as Script[];
}

/**
 * Stato della generazione per una settimana. La coda è leggibile solo dal service role:
 * chiamare solo dopo aver verificato che l'utente è membro dell'azienda.
 */
export async function getGenerationState(
  workspaceId: string,
  weekStart: string,
): Promise<GenerationState> {
  let data: { status: string } | null = null;
  try {
    ({ data } = await createAdminClient()
      .from("jobs")
      .select("status")
      .eq("dedupe_key", `generate_scripts:${workspaceId}:${weekStart}`)
      .maybeSingle());
  } catch (e) {
    // Senza SUPABASE_SECRET_KEY la pagina resta utilizzabile (stato sconosciuto).
    console.error(JSON.stringify({ msg: "stato generazione non leggibile", error: String(e) }));
  }
  return (data?.status as GenerationState) ?? null;
}

/** Settimana da mostrare di default: l'ultima con script, oppure quella in preparazione. */
export async function defaultWeek(workspaceId: string) {
  const batches = await listBatches(workspaceId, 1);
  const planning = firstScriptsWeek(new Date());
  const latest = batches[0]?.week_start;
  return latest && latest >= planning ? latest : (latest ?? planning);
}

const dayFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
const dayOnly = new Intl.DateTimeFormat("it-IT", { day: "numeric", timeZone: "UTC" });

/** "dal 9 al 15 novembre" */
export function weekLabel(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return `dal ${sameMonth ? dayOnly.format(start) : dayFmt.format(start)} al ${dayFmt.format(end)}`;
}

export function shortWeekLabel(weekStart: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${weekStart}T00:00:00Z`));
}

export const FORMAT_LABELS: Record<Script["format"], string> = {
  talking_head: "Parli in camera",
  tutorial: "Tutorial",
  behind_the_scenes: "Dietro le quinte",
  product: "Prodotto",
  testimonial: "Storia vera",
};

export const STATUS_LABELS: Record<Script["status"], string> = {
  to_shoot: "Da girare",
  uploaded: "Girato",
  skipped: "Saltato",
};
