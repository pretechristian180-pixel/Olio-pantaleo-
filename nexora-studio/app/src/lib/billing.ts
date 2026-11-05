import "server-only";

import type { Tables } from "@nexora/shared";

import { createClient } from "@/lib/supabase/server";

type Workspace = Tables<"workspaces">;
export type Plan = Tables<"plans">;

export type BlockReason = "trial_over" | "payment_failed" | "inactive" | "limit_reached";

/** Inizio del periodo dei contatori: quello dell'abbonamento o il mese solare (come in SQL). */
function periodKey(ws: Workspace) {
  if (ws.period_start) return ws.period_start;
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Piano, consumi del periodo e motivo dell'eventuale blocco dei nuovi montaggi. */
export async function getPlanUsage(ws: Workspace) {
  const supabase = await createClient();
  const isTrial = !ws.plan_id;
  const [{ data: plan }, { data: counters }] = await Promise.all([
    ws.plan_id
      ? supabase.from("plans").select("*").eq("id", ws.plan_id).maybeSingle()
      : Promise.resolve({ data: null }),
    isTrial
      ? Promise.resolve({ data: [] as Tables<"usage_counters">[] })
      : supabase.from("usage_counters").select("*").eq("workspace_id", ws.id),
  ]);
  const key = new Date(periodKey(ws)).getTime();
  const counter = (counters ?? []).find((c) => new Date(c.period_start).getTime() === key);
  const videosUsed = isTrial ? 3 - ws.trial_videos_left : (counter?.videos_used ?? 0);
  const videosLimit = isTrial ? 3 : (plan?.videos_per_month ?? 0);

  let blocked: BlockReason | null = null;
  if (isTrial) blocked = ws.trial_videos_left <= 0 ? "trial_over" : null;
  else if (ws.subscription_status === "past_due" || ws.subscription_status === "unpaid")
    blocked = "payment_failed";
  else if (ws.subscription_status !== "active") blocked = "inactive";
  else if (videosUsed >= videosLimit) blocked = "limit_reached";

  return {
    isTrial,
    plan: plan as Plan | null,
    videosUsed,
    videosLimit,
    brollUsed: counter?.broll_credits_used ?? 0,
    brollLimit: plan?.broll_credits_month ?? 0,
    periodEnd: ws.period_end,
    blocked,
  };
}

export const BLOCK_MESSAGES: Record<BlockReason, { title: string; text: string; cta: string }> = {
  trial_over: {
    title: "Hai usato i 3 video della prova",
    text: "Scegli un piano per continuare a ricevere script e video montati. Quello che hai fatto finora resta tutto qui.",
    cta: "Scegli il piano",
  },
  payment_failed: {
    title: "L'ultimo pagamento non è andato a buon fine",
    text: "I nuovi montaggi sono in pausa finché il pagamento non va a buon fine. Video, calendario e post programmati restano al loro posto.",
    cta: "Aggiorna il pagamento",
  },
  inactive: {
    title: "L'abbonamento non è attivo",
    text: "Riattiva un piano per caricare nuovi video. Tutto quello che hai fatto resta qui.",
    cta: "Riattiva il piano",
  },
  limit_reached: {
    title: "Hai montato tutti i video del mese",
    text: "Passa a un piano superiore per montarne altri subito, oppure aspetta il rinnovo.",
    cta: "Vedi i piani",
  },
};

export const euro = (cents: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);

export const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Rome",
});
