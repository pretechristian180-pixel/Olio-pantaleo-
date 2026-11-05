import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, isTenantOpen } from "@/lib/tenant";

export type Role = "student" | "instructor" | "admin";

export type Profile = { id: string; nome: string; cognome: string; avatar_url: string | null };
export type Membership = { ruolo: Role; consenso_marketing: boolean };

export type SessionUser = {
  id: string;
  email: string;
  profile: Profile | null;
  /** Appartenenza all'academy che l'utente sta visitando (null se non ne fa parte). */
  membership: Membership | null;
};

/** Utente collegato (verificato con il server Auth), profilo e ruolo nell'academy corrente. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const tenant = await getCurrentTenant();
  const [{ data: profile }, membership] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, cognome, avatar_url")
      .eq("id", data.user.id)
      .maybeSingle(),
    tenant
      ? supabase
          .from("memberships")
          .select("ruolo, consenso_marketing")
          .eq("user_id", data.user.id)
          .eq("tenant_id", tenant.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    profile: (profile as Profile | null) ?? null,
    membership: (membership as Membership | null) ?? null,
  };
});

/**
 * Pagine dell'area studente: serve l'accesso. Se la persona ha già un account
 * (magari creato in un'altra academy) la iscriviamo come studente a questa.
 */
export async function requireUser(next = "/app") {
  const user = await getSessionUser();
  if (!user) redirect(`/accedi?next=${encodeURIComponent(next)}`);
  if (!user.membership) {
    const tenant = await getCurrentTenant();
    if (tenant && isTenantOpen(tenant)) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("join_tenant", { p_tenant_id: tenant.id });
      if (!error) user.membership = { ruolo: "student", consenso_marketing: false };
    }
  }
  return user;
}

export function isStaffRole(role: Role | undefined) {
  return role === "admin" || role === "instructor";
}

export async function requireStaff() {
  const user = await requireUser("/admin");
  if (!isStaffRole(user.membership?.ruolo)) redirect("/app");
  return user;
}

export async function requireTenantAdmin() {
  const user = await requireUser("/admin");
  if (user.membership?.ruolo !== "admin") redirect("/admin");
  return user;
}

export function displayName(user: SessionUser) {
  const n = user.profile?.nome?.trim();
  return n || user.email.split("@")[0] || "studente";
}
