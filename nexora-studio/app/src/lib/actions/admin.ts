"use server";

import type { Json } from "@nexora/shared";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { inviteMember, type InviteState } from "@/lib/actions/team";
import { assertAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";

const VIDEO_JOBS = new Set(["transcribe", "edit", "render"]);

export type AdminActionResult = { ok?: boolean; error?: string; message?: string };

async function audit(userId: string, workspaceId: string | null, action: string, details: Json) {
  await createAdminClient()
    .from("audit_log")
    .insert({ workspace_id: workspaceId, user_id: userId, action, details });
}

/** Video collegato a un job (payload con video_id o version_id). */
async function videoOfJob(payload: Json) {
  const p = (payload ?? {}) as { video_id?: string; version_id?: string };
  const db = createAdminClient();
  if (p.video_id) return { videoId: p.video_id, versionId: p.version_id ?? null };
  if (p.version_id) {
    const { data } = await db
      .from("video_versions")
      .select("video_id")
      .eq("id", p.version_id)
      .maybeSingle();
    return data ? { videoId: data.video_id, versionId: p.version_id } : null;
  }
  return null;
}

/**
 * Rimette in coda un job fallito, da zero tentativi. Per i job di montaggio riporta il video
 * "in montaggio" (senza riaddebitarlo: se era stato restituito alla quota resta gratuito).
 */
export async function retryJobAction(jobId: string): Promise<AdminActionResult> {
  try {
    const ctx = await assertAdmin();
    const db = createAdminClient();
    const { data: job } = await db.from("jobs").select("*").eq("id", jobId).single();
    if (!job) return { error: "Job non trovato." };
    if (job.status !== "failed") return { error: "Si possono riprovare solo i job falliti." };
    if (job.type === "publish") {
      return { error: "La pubblicazione si riprogramma dal calendario o dalla pagina del video." };
    }

    if (VIDEO_JOBS.has(job.type)) {
      const ref = await videoOfJob(job.payload);
      if (ref) {
        const { data: video } = await db
          .from("videos")
          .select("id, status, raw_upload_id")
          .eq("id", ref.videoId)
          .single();
        if (video?.status === "error") {
          await db.from("videos").update({ status: "editing", error: null }).eq("id", video.id);
          await db
            .from("raw_uploads")
            .update({ status: "processing", error: null })
            .eq("id", video.raw_upload_id);
        }
        if (ref.versionId)
          await db.from("video_versions").update({ status: "pending" }).eq("id", ref.versionId);
      }
    }

    await db
      .from("jobs")
      .update({
        status: "queued",
        attempts: 0,
        run_after: new Date().toISOString(),
        finished_at: null,
        last_error: null,
      })
      .eq("id", jobId);
    await audit(ctx.user.id, job.workspace_id, "admin.job.retry", {
      job_id: jobId,
      type: job.type,
      previous_error: job.last_error,
    });
    revalidatePath("/admin/job");
    revalidatePath("/admin");
    return { ok: true, message: "Job rimesso in coda." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Operazione non riuscita." };
  }
}

/** Annulla un job in coda. Per i job di montaggio il video va in errore e torna alla quota. */
export async function cancelJobAction(jobId: string): Promise<AdminActionResult> {
  try {
    const ctx = await assertAdmin();
    const db = createAdminClient();
    const { data: job } = await db.from("jobs").select("*").eq("id", jobId).single();
    if (!job) return { error: "Job non trovato." };
    if (job.status !== "queued") return { error: "Si possono annullare solo i job in coda." };

    // Solo se nessun worker lo ha preso nel frattempo
    const { data: updated } = await db
      .from("jobs")
      .update({
        status: "failed",
        last_error: "Annullato dal team Nexora",
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "queued")
      .select("id");
    if (!updated?.length) return { error: "Il job è appena partito: non si può più annullare." };

    if (VIDEO_JOBS.has(job.type)) {
      const ref = await videoOfJob(job.payload);
      if (ref) {
        await db
          .from("videos")
          .update({ status: "error", error: "Montaggio annullato: scrivici per riprovare." })
          .eq("id", ref.videoId);
        await db.rpc("release_video", { p_video_id: ref.videoId });
      }
    }
    await audit(ctx.user.id, job.workspace_id, "admin.job.cancel", {
      job_id: jobId,
      type: job.type,
    });
    revalidatePath("/admin/job");
    return { ok: true, message: "Job annullato." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Operazione non riuscita." };
  }
}

const int = (fd: FormData, key: string) => {
  const n = Number(fd.get(key));
  return Number.isInteger(n) && n >= 0 ? n : null;
};

/**
 * Limiti e prezzi dei piani (tabella plans). Un nuovo prezzo vale su Stripe solo dopo
 * `npm run stripe:setup`; gli abbonati esistenti restano al prezzo che hanno.
 */
export async function updatePlanAction(
  _prev: AdminActionResult | null,
  fd: FormData,
): Promise<AdminActionResult> {
  try {
    const ctx = await assertAdmin();
    const id = String(fd.get("plan_id"));
    const values = {
      price_monthly_cents: int(fd, "price_monthly_cents"),
      price_yearly_cents: int(fd, "price_yearly_cents"),
      videos_per_month: int(fd, "videos_per_month"),
      social_accounts_max: int(fd, "social_accounts_max"),
      broll_credits_month: int(fd, "broll_credits_month"),
      brands_max: int(fd, "brands_max"),
    };
    if (Object.values(values).some((v) => v === null))
      return { error: "Usa solo numeri interi, zero o più." };
    if (values.brands_max! < 1) return { error: "Almeno 1 brand." };
    const active = fd.get("active") === "on";

    const db = createAdminClient();
    const { data: before } = await db.from("plans").select("*").eq("id", id).single();
    if (!before) return { error: "Piano non trovato." };
    const { error } = await db
      .from("plans")
      .update({ ...(values as Record<keyof typeof values, number>), active })
      .eq("id", id);
    if (error) return { error: "Salvataggio non riuscito." };

    const priceChanged =
      before.price_monthly_cents !== values.price_monthly_cents ||
      before.price_yearly_cents !== values.price_yearly_cents;
    await audit(ctx.user.id, null, "admin.plan.update", {
      plan_id: id,
      before,
      after: { ...values, active },
    } as unknown as Json);
    revalidatePath("/admin/piani");
    revalidatePath("/piano");
    return {
      ok: true,
      message: priceChanged
        ? `Piano ${before.name} salvato. Prezzo cambiato: lancia npm run stripe:setup per aggiornarlo su Stripe.`
        : `Piano ${before.name} salvato.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Operazione non riuscita." };
  }
}

/**
 * Nuova azienda per un cliente: la crea il team (che ne diventa titolare per compilare il
 * profilo), poi invita il cliente come titolare. All'accettazione il team passa a collaboratore.
 */
export async function adminCreateClientWorkspaceAction(
  _prev: AdminActionResult | null,
  fd: FormData,
): Promise<AdminActionResult> {
  let id: string;
  try {
    await assertAdmin();
    const name = String(fd.get("name") ?? "")
      .trim()
      .slice(0, 120);
    if (name.length < 2) return { error: "Scrivi il nome dell'azienda." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_workspace", { p_name: name });
    if (error || !data) return { error: "Non siamo riusciti a creare l'azienda." };
    id = data.id;
    // Si parte dal primo passo dell'onboarding: settore, città, sito.
    await supabase.from("workspaces").update({ onboarding_step: 1 }).eq("id", id);
    await audit((await assertAdmin()).user.id, id, "admin.workspace.created_for_client", { name });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Operazione non riuscita." };
  }
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/onboarding");
}

/** Il team apre un'azienda di cui fa parte (cambio dell'azienda attiva). */
export async function adminOpenWorkspaceAction(fd: FormData) {
  const ctx = await assertAdmin();
  const id = String(fd.get("workspace_id"));
  if (!ctx.memberships.some((m) => m.workspace.id === id))
    throw new Error("Non fai parte di questa azienda.");
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  const ws = ctx.memberships.find((m) => m.workspace.id === id)!.workspace;
  redirect(ws.onboarding_completed_at ? "/inizio" : "/onboarding");
}

/** Invita il cliente come titolare dell'azienda preparata dal team. */
export async function adminInviteOwnerAction(
  _prev: InviteState,
  fd: FormData,
): Promise<InviteState> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Solo il team Nexora." };
  }
  fd.set("role", "owner");
  const res = await inviteMember(null, fd);
  revalidatePath("/admin/aziende");
  return res;
}
