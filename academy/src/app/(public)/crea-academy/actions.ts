"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { requestHost } from "@/lib/tenant";
import { academyUrlFrom } from "@/lib/tenant-host";

const schema = z.object({
  nome: z.string().trim().min(2, "Scrivi il nome della tua academy.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "L'indirizzo deve avere almeno 3 caratteri.")
    .max(30, "L'indirizzo può avere al massimo 30 caratteri.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo lettere minuscole, numeri e trattini."),
  piano: z.enum(["start", "pro", "business"]),
  termini: z.literal(true, { message: "Per continuare accetta le condizioni del servizio." }),
});

export type CreateState =
  | null
  | { ok: false; error: string; fields?: Record<string, string> }
  | { ok: true; url: string | null; slug: string };

export async function createAcademy(_prev: CreateState, formData: FormData): Promise<CreateState> {
  await requireUser("/crea-academy");
  const parsed = schema.safeParse({
    nome: formData.get("nome"),
    slug: formData.get("slug"),
    piano: formData.get("piano"),
    termini: formData.get("termini") === "on",
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Controlla i campi evidenziati.", fields };
  }
  const { nome, slug, piano } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tenant", {
    p_nome: nome,
    p_slug: slug,
    p_piano: piano,
  });
  if (error) {
    const msg =
      error.code === "23505"
        ? "Questo indirizzo è già preso o non si può usare. Provane un altro."
        : error.code === "53400"
          ? "Hai già creato il numero massimo di academy (3). Scrivici se te ne serve un'altra."
          : "Non siamo riusciti a creare l'academy. Riprova tra poco.";
    return { ok: false, error: msg, fields: error.code === "23505" ? { slug: msg } : undefined };
  }
  return {
    ok: true,
    slug,
    url: academyUrlFrom(
      await requestHost(),
      slug,
      publicEnv.NEXT_PUBLIC_ROOT_DOMAIN,
      "/admin/impostazioni",
    ),
  };
}
