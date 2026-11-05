import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { displayName, requireWorkspace } from "@/lib/workspace";

/** Area cliente: serve l'accesso e un'azienda con l'onboarding completato. */
export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;

  let planLabel = "Prova gratuita";
  if (ws.plan_id) {
    const supabase = await createClient();
    const { data } = await supabase.from("plans").select("name").eq("id", ws.plan_id).maybeSingle();
    planLabel = data?.name ?? planLabel;
  }

  return (
    <AppShell
      user={{ name: displayName(ctx), email: ctx.user.email }}
      workspace={{ id: ws.id, name: ws.name, planLabel }}
      workspaces={ctx.memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name }))}
    >
      {children}
    </AppShell>
  );
}
