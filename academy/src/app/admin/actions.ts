"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { legalSchema } from "@/lib/legal";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colore non valido: usa il formato #RRGGBB.");

const brandSchema = z.object({
  nome: z.string().trim().min(2, "Scrivi il nome dell'academy.").max(120),
  logo_text: z
    .string()
    .trim()
    .min(1, "Scrivi il testo del logo.")
    .max(24, "Al massimo 24 caratteri."),
  logo_url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || /^https:\/\/.+/.test(v),
      "L'indirizzo del logo deve iniziare con https://",
    ),
  tagline: z.string().trim().max(120, "Al massimo 120 caratteri."),
  primary: hex,
  dark: hex,
});

export type BrandState =
  null | { ok: true } | { ok: false; error: string; fields?: Record<string, string> };

export async function updateBrand(_prev: BrandState, formData: FormData): Promise<BrandState> {
  await requireTenantAdmin();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Academy non trovata." };
  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Controlla i campi evidenziati.", fields };
  }
  const { nome, logo_text, logo_url, tagline, primary, dark } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      nome,
      brand: {
        logo_text,
        logo_url: logo_url || null,
        tagline: tagline || null,
        primary: primary.toLowerCase(),
        dark: dark.toLowerCase(),
      },
    })
    .eq("id", tenant.id);
  if (error) return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export type LegalState = null | { ok: true } | { ok: false; error: string };

/** Dati legali dell'academy: compaiono nel footer e nelle pagine legali. */
export async function updateLegal(_prev: LegalState, formData: FormData): Promise<LegalState> {
  await requireTenantAdmin();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Academy non trovata." };
  const raw = Object.fromEntries(formData);
  const data = legalSchema.parse(raw);
  if (data.email && !z.string().email().safeParse(data.email).success)
    return { ok: false, error: "L'email di contatto non è valida." };
  if (data.pec && !z.string().email().safeParse(data.pec).success)
    return { ok: false, error: "La PEC non è valida." };
  if (data.piva && !/^[A-Z]{0,2}[0-9A-Z]{8,15}$/i.test(data.piva.replace(/\s/g, "")))
    return { ok: false, error: "La partita IVA non sembra valida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ dati_legali: data })
    .eq("id", tenant.id);
  if (error) return { ok: false, error: "Dati non salvati. Riprova." };
  revalidatePath("/", "layout");
  return { ok: true };
}
