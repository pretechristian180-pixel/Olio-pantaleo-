import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { parseBrand, type Brand } from "@/lib/brand";
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
  platform_plans: {
    codice: string;
    nome: string;
    senza_marchio_nexora: boolean;
    dominio_personalizzato: boolean;
  } | null;
};

const COLUMNS =
  "id, nome, slug, stato, brand, dominio_personalizzato, prova_fine_il, stripe_pagamenti_attivi, platform_plans(codice, nome, senza_marchio_nexora, dominio_personalizzato)";

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
