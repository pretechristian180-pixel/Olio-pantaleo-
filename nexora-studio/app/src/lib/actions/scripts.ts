"use server";

import { createLLMProvider, LLMError, regenerateScriptById } from "@nexora/shared/server";
import { revalidatePath } from "next/cache";

import type { FormState } from "@/components/forms/form-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/workspace";

function str(fd: FormData, key: string, max = 1000) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Script visibile all'utente (RLS): conferma anche l'appartenenza all'azienda. */
async function loadOwnScript(scriptId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scripts")
    .select("id, workspace_id, batch_id")
    .eq("id", scriptId)
    .maybeSingle();
  if (!data) throw new Error("Script non trovato.");
  await assertMember(data.workspace_id);
  return data;
}

/** Segna uno script come saltato o lo rimette tra quelli da girare. */
export async function setScriptStatus(fd: FormData) {
  const script = await loadOwnScript(str(fd, "script_id"));
  const status = str(fd, "status") === "skipped" ? "skipped" : "to_shoot";
  const supabase = await createClient();
  await supabase.from("scripts").update({ status }).eq("id", script.id);
  revalidatePath("/script", "layout");
  revalidatePath("/inizio");
}

/** Riscrive uno script con l'AI (massimo 3 volte a settimana per azienda). */
export async function regenerateScriptAction(_prev: FormState, fd: FormData): Promise<FormState> {
  let script;
  try {
    script = await loadOwnScript(str(fd, "script_id"));
  } catch {
    return { error: "Script non trovato." };
  }
  const feedback = str(fd, "feedback", 600);
  const admin = createAdminClient();

  const { error: quotaError } = await admin.rpc("use_script_regeneration", {
    p_script_id: script.id,
  });
  if (quotaError) {
    return {
      error:
        quotaError.code === "P0001"
          ? "Hai già usato le 3 riscritture di questa settimana. Puoi segnare lo script come saltato."
          : "Non è stato possibile riscrivere lo script. Riprova.",
    };
  }

  try {
    await regenerateScriptById(admin, createLLMProvider(), { scriptId: script.id, feedback });
  } catch (e) {
    // La riscrittura non è avvenuta: restituiamo il tentativo.
    await admin.rpc("refund_script_regeneration", { p_script_id: script.id });
    const message =
      e instanceof LLMError && e.code === "refusal"
        ? "Non siamo riusciti a scrivere questo script. Prova a spiegare meglio cosa vuoi."
        : "L'AI non ha risposto in tempo. Riprova tra qualche minuto: il tentativo non è stato conteggiato.";
    console.error(
      JSON.stringify({ msg: "rigenerazione non riuscita", script: script.id, error: String(e) }),
    );
    return { error: message };
  }

  revalidatePath("/script", "layout");
  revalidatePath("/inizio");
  return { success: "Ecco il nuovo script." };
}

/** Rimette in coda una generazione settimanale fallita (solo titolare). */
export async function retryWeekGeneration(fd: FormData) {
  const workspaceId = str(fd, "workspace_id");
  const week = str(fd, "week_start");
  await assertMember(workspaceId, "owner");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return;
  const admin = createAdminClient();
  const key = `generate_scripts:${workspaceId}:${week}`;
  const { data: job } = await admin
    .from("jobs")
    .select("id, status")
    .eq("dedupe_key", key)
    .maybeSingle();
  if (job?.status === "failed") {
    // Nuovo giro di tentativi sullo stesso job (stessa chiave: nessun doppione).
    await admin
      .from("jobs")
      .update({
        status: "queued",
        attempts: 0,
        run_after: new Date().toISOString(),
        finished_at: null,
      })
      .eq("id", job.id);
  } else if (!job) {
    await admin.rpc("enqueue_job", {
      p_type: "generate_scripts",
      p_workspace_id: workspaceId,
      p_payload: { week_start: week },
      p_dedupe_key: key,
    });
  }
  revalidatePath("/script", "layout");
}
