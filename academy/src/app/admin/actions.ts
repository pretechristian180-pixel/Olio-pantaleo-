"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";

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
