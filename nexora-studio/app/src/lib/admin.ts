import "server-only";

import { notFound, redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/workspace";

/** Pagine e azioni del team CP Studio: solo profili con is_admin. */
export async function requireAdmin(next = "/admin") {
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/accedi?next=${encodeURIComponent(next)}`);
  if (!ctx.profile?.is_admin) notFound();
  return ctx;
}

/** Per le Server Action: errore se non è del team. */
export async function assertAdmin() {
  const ctx = await getSessionContext();
  if (!ctx?.profile?.is_admin) throw new Error("Solo il team CP Studio.");
  return ctx;
}

/** I costi dei fornitori sono in dollari: conversione indicativa per i confronti con i ricavi. */
export const USD_EUR = Number(process.env.USD_EUR_RATE ?? "0.92") || 0.92;

/** Euro; sotto i 10 centesimi tre decimali, così i costi piccoli non sembrano zero. */
export const eur = (v: number, digits = v !== 0 && Math.abs(v) < 0.1 ? 3 : 2) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);

export const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);

const DAY = 86400e3;

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i]!;
}

/** Tutto quello che serve alla dashboard, letto con la chiave di servizio (dopo requireAdmin). */
export async function getDashboard(now = new Date()) {
  const db = createAdminClient();
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const since14 = new Date(now.getTime() - 13 * DAY);
  since14.setHours(0, 0, 0, 0);
  const since24h = new Date(now.getTime() - DAY).toISOString();

  const [
    { data: workspaces },
    { data: plans },
    { data: videos30 },
    { data: costs30 },
    { data: queued },
    { count: running },
    { count: failed24 },
    { data: errors },
  ] = await Promise.all([
    db
      .from("workspaces")
      .select(
        "id, name, plan_id, subscription_status, billing_interval, billing_workspace_id, payment_failed_at, onboarding_completed_at, created_at",
      ),
    db.from("plans").select("id, name, price_monthly_cents, price_yearly_cents"),
    db
      .from("videos")
      .select("id, workspace_id, status, created_at")
      .gte("created_at", since30)
      .limit(10000),
    db
      .from("provider_costs")
      .select("video_id, operation, cost_usd, created_at")
      .gte("created_at", since30)
      .limit(50000),
    db
      .from("jobs")
      .select("id, run_after")
      .eq("status", "queued")
      .lte("run_after", now.toISOString())
      .order("run_after")
      .limit(1000),
    db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "running"),
    db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("updated_at", since24h),
    db
      .from("videos")
      .select("id, error, updated_at, workspace:workspaces(name)")
      .eq("status", "error")
      .gte("updated_at", new Date(now.getTime() - 7 * DAY).toISOString())
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  // Aziende e ricavi ricorrenti (prezzi di listino; i coupon founding non sono sottratti)
  const payers = (workspaces ?? []).filter((w) => !w.billing_workspace_id);
  const price = new Map((plans ?? []).map((p) => [p.id, p]));
  const paying = payers.filter((w) => w.plan_id && w.subscription_status === "active");
  const mrrCents = paying.reduce((sum, w) => {
    const p = price.get(w.plan_id!);
    if (!p) return sum;
    return (
      sum + (w.billing_interval === "year" ? p.price_yearly_cents / 12 : p.price_monthly_cents)
    );
  }, 0);
  const byPlan = (plans ?? []).map((p) => ({
    name: p.name,
    count: paying.filter((w) => w.plan_id === p.id).length,
  }));
  const trials = payers.filter((w) => !w.plan_id && w.onboarding_completed_at).length;
  const pastDue = payers.filter((w) => ["past_due", "unpaid"].includes(w.subscription_status));

  // Costi: per video (montaggio completo) e fuori dai video (script)
  const costs = costs30 ?? [];
  const totalUsd = costs.reduce((s, c) => s + Number(c.cost_usd), 0);
  const videoCostUsd = new Map<string, number>();
  for (const c of costs) {
    if (c.video_id)
      videoCostUsd.set(c.video_id, (videoCostUsd.get(c.video_id) ?? 0) + Number(c.cost_usd));
  }
  const renders = costs.filter((c) => c.operation === "render" && c.video_id);
  const renderedVideos = new Set(renders.map((c) => c.video_id!));
  const perVideo = [...renderedVideos].map((id) => videoCostUsd.get(id) ?? 0);
  const avgVideoUsd = perVideo.length
    ? perVideo.reduce((a, b) => a + b, 0) / perVideo.length
    : null;

  // Tempo dal caricamento alla prima versione pronta (obiettivo: < 15 min)
  const created = new Map((videos30 ?? []).map((v) => [v.id, new Date(v.created_at).getTime()]));
  const firstRender = new Map<string, number>();
  for (const r of renders) {
    const t = new Date(r.created_at).getTime();
    if (!firstRender.has(r.video_id!) || t < firstRender.get(r.video_id!)!)
      firstRender.set(r.video_id!, t);
  }
  const minutes = [...firstRender.entries()]
    .filter(([id]) => created.has(id))
    .map(([id, t]) => (t - created.get(id)!) / 60000)
    .sort((a, b) => a - b);
  const under15 = minutes.length ? minutes.filter((m) => m < 15).length / minutes.length : null;

  // Video caricati per giorno (14 giorni, ora italiana)
  const perDay = new Map<string, number>();
  for (let i = 0; i < 14; i++)
    perDay.set(dayKey(new Date(since14.getTime() + i * DAY + 12 * 3600e3)), 0);
  for (const v of videos30 ?? []) {
    const k = dayKey(new Date(v.created_at));
    if (perDay.has(k)) perDay.set(k, perDay.get(k)! + 1);
  }

  const oldestQueued = queued?.[0]
    ? (now.getTime() - new Date(queued[0].run_after).getTime()) / 60000
    : 0;
  const internalReview = (videos30 ?? []).filter((v) => v.status === "internal_review").length;

  return {
    mrrEur: mrrCents / 100,
    paying: paying.length,
    byPlan,
    trials,
    pastDue: pastDue.map((w) => ({ id: w.id, name: w.name, since: w.payment_failed_at })),
    videos30: videos30?.length ?? 0,
    rendered30: renderedVideos.size,
    perDay: [...perDay.entries()].map(([day, count]) => ({ day, count })),
    costs30Eur: totalUsd * USD_EUR,
    avgVideoEur: avgVideoUsd === null ? null : avgVideoUsd * USD_EUR,
    marginEur: mrrCents / 100 - totalUsd * USD_EUR,
    medianMinutes: quantile(minutes, 0.5),
    p90Minutes: quantile(minutes, 0.9),
    under15,
    jobs: {
      queued: queued?.length ?? 0,
      running: running ?? 0,
      failed24: failed24 ?? 0,
      oldestQueuedMin: Math.round(oldestQueued),
    },
    internalReview,
    errors: (errors ?? []).map((e) => ({
      id: e.id,
      error: e.error,
      at: e.updated_at,
      workspace: (e.workspace as { name: string } | null)?.name ?? "—",
    })),
  };
}

export const OPERATION_LABELS: Record<string, string> = {
  transcribe: "Trascrizione",
  edit_plan: "Piano di montaggio",
  broll: "B-roll",
  render: "Render",
  publish: "Pubblicazione",
  generate_scripts: "Script settimanali",
  regenerate_script: "Script riscritti",
};

export const VIDEO_OPERATIONS = ["transcribe", "edit_plan", "broll", "render", "publish"] as const;

/** Costo di ogni video montato nel periodo, scomposto per passaggio. */
export async function getVideoCosts(days = 30, now = new Date()) {
  const db = createAdminClient();
  const since = new Date(now.getTime() - days * DAY).toISOString();
  const { data: costs } = await db
    .from("provider_costs")
    .select("video_id, workspace_id, operation, cost_usd, created_at")
    .gte("created_at", since)
    .limit(50000);

  const rows = new Map<
    string,
    {
      videoId: string;
      workspaceId: string | null;
      ops: Record<string, number>;
      total: number;
      last: string;
    }
  >();
  const nonVideo: Record<string, number> = {};
  const byWorkspace = new Map<string, number>();
  for (const c of costs ?? []) {
    const eurValue = Number(c.cost_usd) * USD_EUR;
    if (c.workspace_id)
      byWorkspace.set(c.workspace_id, (byWorkspace.get(c.workspace_id) ?? 0) + eurValue);
    if (!c.video_id) {
      nonVideo[c.operation] = (nonVideo[c.operation] ?? 0) + eurValue;
      continue;
    }
    const row = rows.get(c.video_id) ?? {
      videoId: c.video_id,
      workspaceId: c.workspace_id,
      ops: {},
      total: 0,
      last: c.created_at,
    };
    row.ops[c.operation] = (row.ops[c.operation] ?? 0) + eurValue;
    row.total += eurValue;
    if (c.created_at > row.last) row.last = c.created_at;
    rows.set(c.video_id, row);
  }

  const ids = [...rows.keys()];
  const wsIds = [...new Set([...byWorkspace.keys()])];
  const [{ data: videos }, { data: workspaces }] = await Promise.all([
    ids.length
      ? db.from("videos").select("id, status, current_version, script:scripts(title)").in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
    wsIds.length
      ? db.from("workspaces").select("id, name").in("id", wsIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const vmap = new Map((videos ?? []).map((v) => [v.id, v]));
  const wname = new Map((workspaces ?? []).map((w) => [w.id, w.name]));

  const list = [...rows.values()]
    .sort((a, b) => b.last.localeCompare(a.last))
    .map((r) => {
      const v = vmap.get(r.videoId) as
        { status: string; current_version: number; script: { title: string } | null } | undefined;
      return {
        ...r,
        workspace: r.workspaceId ? (wname.get(r.workspaceId) ?? "—") : "—",
        title: v?.script?.title ?? "Video libero",
        status: v?.status ?? "—",
        versions: v?.current_version ?? 0,
      };
    });
  const totals = Object.fromEntries(
    VIDEO_OPERATIONS.map((op) => [op, list.reduce((s, r) => s + (r.ops[op] ?? 0), 0)]),
  ) as Record<string, number>;
  const rendered = list.filter((r) => r.ops.render);

  return {
    list,
    totals,
    avg: rendered.length ? rendered.reduce((s, r) => s + r.total, 0) / rendered.length : null,
    max: rendered.length ? Math.max(...rendered.map((r) => r.total)) : null,
    nonVideo,
    byWorkspace: [...byWorkspace.entries()]
      .map(([id, total]) => ({ id, name: wname.get(id) ?? "—", total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
  };
}
