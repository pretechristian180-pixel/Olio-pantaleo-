import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Tables } from "@nexora/shared";

import { createClient } from "@/lib/supabase/server";

export const ACTIVE_WORKSPACE_COOKIE = "nx_ws";

export type Workspace = Tables<"workspaces">;
export type Role = "owner" | "member";

export interface Membership {
  role: Role;
  workspace: Workspace;
}

export interface SessionContext {
  user: { id: string; email: string };
  profile: Tables<"profiles"> | null;
  memberships: Membership[];
  active: Membership | null;
}

/** Utente autenticato (verificato con il server Auth), una volta per richiesta. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
});

/** Utente, profilo, workspace di cui è membro e workspace attivo (cookie). */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role, workspace:workspaces(*)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true }),
  ]);

  const memberships: Membership[] = (rows ?? [])
    .filter((r): r is typeof r & { workspace: Workspace } => r.workspace !== null)
    .map((r) => ({ role: r.role, workspace: r.workspace }));

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspace.id === preferred) ?? memberships[0] ?? null;

  return { user, profile, memberships, active };
});

/** Per le pagine dell'area cliente: serve accesso e onboarding completato. */
export async function requireWorkspace() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/accedi");
  if (!ctx.active || !ctx.active.workspace.onboarding_completed_at) redirect("/onboarding");
  return { ...ctx, active: ctx.active };
}

/** Per le Server Action: utente membro del workspace indicato (o errore). */
export async function assertMember(workspaceId: string, role?: Role) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Accesso richiesto.");
  const m = ctx.memberships.find((x) => x.workspace.id === workspaceId);
  if (!m) throw new Error("Non fai parte di questa azienda.");
  if (role === "owner" && m.role !== "owner") {
    throw new Error("Solo il titolare può fare questa operazione.");
  }
  return { ctx, membership: m };
}

export function displayName(ctx: Pick<SessionContext, "profile" | "user">) {
  return ctx.profile?.full_name?.trim() || ctx.user.email.split("@")[0] || "Utente";
}

export function firstName(ctx: Pick<SessionContext, "profile" | "user">) {
  return displayName(ctx).split(/\s+/)[0];
}
