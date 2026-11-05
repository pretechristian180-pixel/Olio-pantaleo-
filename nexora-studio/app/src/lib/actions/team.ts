"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/forms/form-message";
import { brandedEmail, getEmailProvider } from "@nexora/shared/server";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_WORKSPACE_COOKIE,
  assertMember,
  displayName,
  getSessionContext,
} from "@/lib/workspace";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export type InviteState = (FormState & { inviteLink?: string }) | null;

/** Invita una persona nel workspace (solo titolare). */
export async function inviteMember(_prev: InviteState, fd: FormData): Promise<InviteState> {
  const workspaceId = str(fd, "workspace_id");
  const { ctx, membership } = await assertMember(workspaceId, "owner");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role") === "owner" ? "owner" : "member";

  if (!EMAIL_RE.test(email)) return { fieldErrors: { email: "Controlla l'indirizzo email." } };
  if (email === ctx.user.email.toLowerCase()) {
    return { fieldErrors: { email: "Questa è la tua email: fai già parte dell'azienda." } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invitations")
    .insert({ workspace_id: workspaceId, email, role, invited_by: ctx.user.id })
    .select("token")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "C'è già un invito aperto per questa email." };
    return { error: "Invito non riuscito. Riprova." };
  }

  const link = `${publicEnv.appUrl}/invito/${data.token}`;
  const inviter = displayName(ctx);
  const companyName = membership.workspace.name;
  const { html, text } = brandedEmail({
    title: `${inviter} ti ha invitato su Nexora Studio`,
    intro: `Entra nel team di ${companyName}: potrai caricare i video, approvarli e vedere il calendario dei post.`,
    ctaLabel: "Accetta l'invito",
    ctaUrl: link,
    outro: "L'invito scade tra 7 giorni. Se non ti aspettavi questa email, puoi ignorarla.",
  });
  const result = await getEmailProvider().send({
    to: email,
    subject: `${inviter} ti ha invitato nel team di ${companyName}`,
    html,
    text,
  });

  revalidatePath("/team");
  return result.sent
    ? { success: `Invito inviato a ${email}.` }
    : {
        success: `Invito creato. L'invio delle email non è ancora attivo: copia il link e mandalo a ${email}.`,
        inviteLink: link,
      };
}

export async function revokeInvitation(fd: FormData) {
  const workspaceId = str(fd, "workspace_id");
  await assertMember(workspaceId, "owner");
  const supabase = await createClient();
  await supabase
    .from("workspace_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", str(fd, "invitation_id"))
    .eq("workspace_id", workspaceId);
  revalidatePath("/team");
}

export async function changeRole(fd: FormData) {
  const workspaceId = str(fd, "workspace_id");
  await assertMember(workspaceId, "owner");
  const role = str(fd, "role") === "owner" ? "owner" : "member";
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", str(fd, "user_id"));
  if (error) throw new Error("Serve almeno un titolare nell'azienda.");
  revalidatePath("/team");
}

export async function removeMember(fd: FormData) {
  const workspaceId = str(fd, "workspace_id");
  const userId = str(fd, "user_id");
  const { ctx } = await assertMember(workspaceId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw new Error("Serve almeno un titolare nell'azienda.");

  if (userId === ctx.user.id) {
    (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
    redirect("/inizio");
  }
  revalidatePath("/team");
}

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/accedi");
  const fullName = str(fd, "full_name").slice(0, 120);
  const phone = str(fd, "phone").slice(0, 30);
  if (fullName.length < 2) return { fieldErrors: { full_name: "Scrivi nome e cognome." } };
  if (phone && !/^\+?[\d\s()-]{6,}$/.test(phone)) {
    return { fieldErrors: { phone: "Controlla il numero di telefono." } };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
    .eq("user_id", ctx.user.id);
  if (error) return { error: "Salvataggio non riuscito. Riprova." };
  revalidatePath("/", "layout");
  return { success: "Profilo aggiornato." };
}

/** Accetta un invito: entra nel workspace e lo rende attivo. */
export async function acceptInvitation(fd: FormData) {
  const ctx = await getSessionContext();
  const token = str(fd, "token");
  if (!ctx) redirect(`/accedi?next=/invito/${token}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !data) redirect(`/invito/${token}?errore=1`);
  await handOverFromTeam(data, token, ctx.user.id);
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, data, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/inizio");
}

/**
 * Azienda preparata dal team Nexora: quando il cliente accetta l'invito da titolare, i membri
 * del team che ne erano titolari restano come collaboratori (non ricevono più email di
 * fatturazione e non gestiscono il piano). Il cliente può rimuoverli dalla pagina Team.
 */
async function handOverFromTeam(workspaceId: string, token: string, newOwnerId: string) {
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("workspace_invitations")
    .select("role")
    .eq("token", token)
    .maybeSingle();
  if (inv?.role !== "owner") return;
  const { data: owners } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .neq("user_id", newOwnerId);
  const ids = (owners ?? []).map((o) => o.user_id);
  const { data: admins } = ids.length
    ? await admin.from("profiles").select("user_id").in("user_id", ids).eq("is_admin", true)
    : { data: [] as { user_id: string }[] };
  const team = admins ?? [];
  for (const o of team) {
    await admin
      .from("workspace_members")
      .update({ role: "member" })
      .eq("workspace_id", workspaceId)
      .eq("user_id", o.user_id);
  }
}
