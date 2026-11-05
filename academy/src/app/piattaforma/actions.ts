"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { academyInvite } from "@/lib/email-templates";
import { registerAcademyDomain } from "@/lib/vercel-domains";
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

export type CreateTenantState =
  null | { ok: true; message: string; id: string } | { ok: false; error: string };

const createSchema = z.object({
  nome: z.string().trim().min(2, "Scrivi il nome dell'azienda.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "L'indirizzo deve avere almeno 3 caratteri.")
    .max(30, "Al massimo 30 caratteri.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo lettere minuscole, numeri e trattini."),
  piano: z.enum(PIANI),
  email: z.string().trim().toLowerCase().email("Email del titolare non valida."),
  giorni: z.coerce.number().int().min(1).max(365),
});

/**
 * Crea un'academy per un cliente: se il titolare non ha un account lo creiamo e gli mandiamo
 * il link per scegliere la password; in ogni caso riceve un'email con l'accesso al pannello.
 */
export async function createTenantForClient(
  _prev: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
  await requirePlatformAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { nome, slug, piano, email, giorni } = parsed.data;
  const supabase = await createClient();
  const root = publicEnv.NEXT_PUBLIC_ROOT_DOMAIN;
  const base = tenantUrl(slug, root, "");

  const create = () =>
    supabase.rpc("platform_create_tenant", {
      p_nome: nome,
      p_slug: slug,
      p_piano: piano,
      p_admin_email: email,
      p_giorni_prova: giorni,
    });

  let { data, error } = await create();
  let link = `${base}/admin`;
  let nuovoAccount = false;
  if (error?.code === "P0002") {
    // Nessun account: lo creiamo con un link di invito (token monouso, scelta della password).
    const admin = createAdminClient();
    const { data: invite, error: e } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${base}/admin` },
    });
    if (e || !invite.properties?.hashed_token)
      return { ok: false, error: "Non è stato possibile creare l'account del titolare." };
    nuovoAccount = true;
    link = `${base}/auth/callback?token_hash=${encodeURIComponent(invite.properties.hashed_token)}&type=invite&next=${encodeURIComponent("/reimposta-password?dopo=/admin")}`;
    ({ data, error } = await create());
  }
  if (error)
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Questo indirizzo è già preso o riservato. Scegline un altro."
          : "Academy non creata. Riprova.",
    };

  await registerAcademyDomain(`${slug}.${root}`);
  const sent = await sendEmail({
    to: email,
    content: academyInvite({ nomeAcademy: nome, url: link, nuovoAccount }),
    idempotencyKey: `invito-academy-${slug}`,
  });
  revalidatePath("/piattaforma");
  return {
    ok: true,
    id: data as string,
    message: `Academy «${nome}» creata: ${slug}.${root}. ${
      sent ? `Invito mandato a ${email}.` : `Email non inviata: manda tu il link a ${email}.`
    }`,
  };
}
