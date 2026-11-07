import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { parseBrand, type Brand } from "@/lib/brand";
import { parseLegal, type LegalData } from "@/lib/legal";
import { effectiveFeatures, omaggioScaduto, type Features } from "@/lib/features";
import { resolveHost, type HostMatch } from "@/lib/tenant-host";

export type TenantStatus = "prova" | "attivo" | "insoluto" | "sospeso" | "chiuso";

export type Tenant = {
  id: string;
  nome: string;
  slug: string;
  stato: TenantStatus;
  brand: Brand;
  dominioPersonalizzato: string | null;
  provaFineIl: string | null;
  /** Funzioni effettive: piano + eccezioni del super-admin. */
  funzioni: Features;
  /** Academy regalata da Nexora (senza abbonamento), con eventuale scadenza. */
  omaggio: { attivo: boolean; fineIl: string | null; scaduto: boolean };
  /** Dati legali di chi vende (pagine legali, footer). */
  legal: LegalData;
  /** Il conto Stripe del cliente può ricevere i pagamenti dei corsi. */
  pagamentiAttivi: boolean;
  piano: {
    codice: string;
    nome: string;
    senzaMarchioNexora: boolean;
    dominioPersonalizzato: boolean;
  } | null;
};

type Row = {
  id: string;
  nome: string;
  slug: string;
  stato: TenantStatus;
  brand: unknown;
  dominio_personalizzato: string | null;
  prova_fine_il: string | null;
  stripe_pagamenti_attivi: boolean;
  dati_legali: unknown;
  omaggio: boolean;
  omaggio_fine_il: string | null;
  funzioni: unknown;
  platform_plans: {
    codice: string;
    nome: string;
    senza_marchio_nexora: boolean;
    dominio_personalizzato: boolean;
    abbonamenti_studenti: boolean;
    max_ore_video: number | null;
    max_studenti_attivi: number | null;
    max_staff: number | null;
    max_landing_ai_mese: number | null;
    max_sezioni_ai_mese: number | null;
  } | null;
};

const COLUMNS =
  "id, nome, slug, stato, brand, dominio_personalizzato, prova_fine_il, stripe_pagamenti_attivi, dati_legali, omaggio, omaggio_fine_il, funzioni, platform_plans(codice, nome, senza_marchio_nexora, dominio_personalizzato, abbonamenti_studenti, max_ore_video, max_studenti_attivi, max_staff, max_landing_ai_mese, max_sezioni_ai_mese)";

export async function requestHost() {
  const h = await headers();
  return h.get("x-forwarded-host") ?? h.get("host");
}

export const getHostMatch = cache(async (): Promise<HostMatch> => {
  return resolveHost(await requestHost(), publicEnv.NEXT_PUBLIC_ROOT_DOMAIN);
});

/** L'academy della richiesta corrente (dal sottodominio o dal dominio personalizzato), o null. */
export const getCurrentTenant = cache(async (): Promise<Tenant | null> => {
  if (!isSupabaseConfigured()) return null;
  const match = await getHostMatch();
  const supabase = await createClient();
  let query = supabase.from("tenants").select(COLUMNS);
  query =
    match.kind === "custom"
      ? query.eq("dominio_personalizzato", match.domain)
      : query.eq("slug", match.kind === "sub" ? match.slug : publicEnv.NEXT_PUBLIC_TENANT_SLUG);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Academy non disponibile: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Row;
  return {
    id: row.id,
    nome: row.nome,
    slug: row.slug,
    stato: row.stato,
    brand: parseBrand(row.brand),
    dominioPersonalizzato: row.dominio_personalizzato,
    provaFineIl: row.prova_fine_il,
    pagamentiAttivi: row.stripe_pagamenti_attivi,
    legal: parseLegal(row.dati_legali),
    funzioni: effectiveFeatures(row.platform_plans, row.funzioni),
    omaggio: {
      attivo: row.omaggio,
      fineIl: row.omaggio_fine_il,
      scaduto: omaggioScaduto(row.omaggio, row.omaggio_fine_il),
    },
    piano: row.platform_plans
      ? {
          codice: row.platform_plans.codice,
          nome: row.platform_plans.nome,
          senzaMarchioNexora: row.platform_plans.senza_marchio_nexora,
          dominioPersonalizzato: row.platform_plans.dominio_personalizzato,
        }
      : null,
  };
});

export function isTenantOpen(t: Pick<Tenant, "stato">) {
  return t.stato === "prova" || t.stato === "attivo" || t.stato === "insoluto";
}

/** È l'academy della piattaforma (dominio principale)? Lì vivono anche /prezzi e /crea-academy. */
export async function isPlatformHost() {
  return (await getHostMatch()).kind === "root";
}

/** L'academy corrente è quella di Nexora (non di un cliente)? */
export async function isNexoraTenant() {
  const t = await getCurrentTenant();
  return !t || t.slug === publicEnv.NEXT_PUBLIC_TENANT_SLUG;
}
