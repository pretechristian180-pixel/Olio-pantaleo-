"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/data/platform";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { tenantUrl } from "@/lib/tenant-host";

const STATI = ["prova", "attivo", "insoluto", "sospeso", "chiuso"] as const;
const PIANI = ["start", "pro", "business"] as const;

async function update(id: string, patch: { stato?: string; piano?: string; prova_fine?: string }) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_update_tenant", {
    p_tenant: id,
    p_stato: patch.stato ?? null,
    p_piano: patch.piano ?? null,
    p_prova_fine: patch.prova_fine ?? null,
  });
  if (error) throw new Error(`Academy non aggiornata: ${error.message}`);
  revalidatePath("/piattaforma");
  revalidatePath(`/piattaforma/${id}`);
}

export async function setTenantStatus(id: string, stato: string) {
  if (!(STATI as readonly string[]).includes(stato)) return;
  await update(id, { stato });
}

export async function setTenantPlan(id: string, formData: FormData) {
  const piano = String(formData.get("piano"));
  if (!(PIANI as readonly string[]).includes(piano)) return;
  await update(id, { piano });
}

/** Prolunga la prova di N giorni (da oggi o dalla fine attuale, se è più avanti). */
export async function extendTrial(id: string, giorni: number, provaFineIl: string | null) {
  const base = Math.max(Date.now(), provaFineIl ? new Date(provaFineIl).getTime() : 0);
  const fine = new Date(base + Math.min(Math.max(giorni, 1), 90) * 86_400_000).toISOString();
  await update(id, { prova_fine: fine, stato: "prova" });
}

/** Entra nel pannello dell'academy come amministratore (assistenza). */
export async function enterTenantAdmin(id: string, slug: string) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_join_as_admin", { p_tenant: id });
  if (error) throw new Error(`Accesso non riuscito: ${error.message}`);
  redirect(
    slug === publicEnv.NEXT_PUBLIC_TENANT_SLUG
      ? "/admin"
      : tenantUrl(slug, publicEnv.NEXT_PUBLIC_ROOT_DOMAIN, "/admin"),
  );
}
