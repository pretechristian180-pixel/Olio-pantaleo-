import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isPlatformHost } from "@/lib/tenant";
import type { PlanFeatures } from "@/lib/features";

/** Il pannello piattaforma vive solo sul dominio principale ed è solo per i super-admin. */
export const isPlatformAdmin = cache(async () => {
  const user = await getSessionUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
});

export async function requirePlatformAdmin() {
  if (!(await isPlatformHost())) notFound();
  const user = await getSessionUser();
  if (!user) redirect("/accedi?next=/piattaforma");
  if (!(await isPlatformAdmin())) notFound();
  return user;
}

export type PlatformOverview = {
  academy_totali: number;
  in_prova: number;
  attive: number;
  insolute: number;
  sospese: number;
  prove_in_scadenza: number;
  mrr_cents: number;
  studenti_totali: number;
  vendite_mese_cents: number;
  omaggi: number;
};

export type TenantStatus = "prova" | "attivo" | "insoluto" | "sospeso" | "chiuso";

export type PlatformTenant = {
  id: string;
  nome: string;
  slug: string;
  stato: TenantStatus;
  piano: string | null;
  piano_codice: string | null;
  prova_fine_il: string | null;
  creato_il: string;
  dominio_personalizzato: string | null;
  abbonamento_attivo: boolean;
  stripe_collegato: boolean;
  pagamenti_attivi: boolean;
  stripe_customer_id: string | null;
  stripe_account_id: string | null;
  studenti: number;
  corsi: number;
  vendite_totali_cents: number;
  admin_email: string | null;
  omaggio: boolean;
  omaggio_fine_il: string | null;
  funzioni: unknown;
};

export async function getPlatformOverview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_overview");
  if (error) throw new Error(`Numeri non disponibili: ${error.message}`);
  return (data as PlatformOverview[])[0]!;
}

export async function getPlatformTenants(cerca?: string, stato?: TenantStatus) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_tenants", {
    p_cerca: cerca?.slice(0, 100) || null,
    p_stato: stato ?? null,
  });
  if (error) throw new Error(`Academy non disponibili: ${error.message}`);
  return (data ?? []) as PlatformTenant[];
}

export async function getPlatformTenant(id: string) {
  return (await getPlatformTenants()).find((t) => t.id === id) ?? null;
}

export async function getTenantTeam(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_tenant_team", { p_tenant: id });
  if (error) throw new Error(`Team non disponibile: ${error.message}`);
  return (data ?? []) as {
    user_id: string;
    nome: string;
    email: string;
    ruolo: "admin" | "instructor";
    dal: string;
  }[];
}

export type PlanWithFeatures = PlanFeatures & {
  codice: string;
  nome: string;
  prezzo_mese_cents: number;
};

/** Piani con i loro limiti: base per le funzioni personalizzate. */
export async function getPlansWithFeatures(): Promise<PlanWithFeatures[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_plans")
    .select(
      "codice, nome, prezzo_mese_cents, max_ore_video, max_studenti_attivi, max_staff, max_landing_ai_mese, max_sezioni_ai_mese, dominio_personalizzato, senza_marchio_nexora, abbonamenti_studenti",
    )
    .eq("attivo", true)
    .order("ordine");
  if (error) throw new Error(`Piani non disponibili: ${error.message}`);
  return (data ?? []) as PlanWithFeatures[];
}
