import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  tenant_id: string;
  nome: string;
  cognome: string;
  avatar_url: string | null;
  ruolo: "student" | "instructor" | "admin";
  consenso_marketing: boolean;
};

export type SessionUser = { id: string; email: string; profile: Profile | null };

/** Utente collegato (verificato con il server Auth) e il suo profilo, o null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, nome, cognome, avatar_url, ruolo, consenso_marketing")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    profile: (profile as Profile | null) ?? null,
  };
});

export async function requireUser(next = "/app") {
  const user = await getSessionUser();
  if (!user) redirect(`/accedi?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireStaff() {
  const user = await requireUser("/admin");
  if (user.profile?.ruolo !== "admin" && user.profile?.ruolo !== "instructor") redirect("/app");
  return user;
}

export function displayName(user: SessionUser) {
  const n = user.profile?.nome?.trim();
  return n || user.email.split("@")[0] || "studente";
}
