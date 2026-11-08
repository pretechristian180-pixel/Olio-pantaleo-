import type { Metadata } from "next";
import { ArrowRight, Building2 } from "lucide-react";

import { InviteOwnerForm, NewClientForm } from "@/components/admin/client-forms";
import { SubmitButton } from "@/components/forms/submit-button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminOpenWorkspaceAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Aziende", robots: { index: false } };

/** Istante della richiesta (fuori dal render per la regola di purezza). */
const STATUS_IT: Record<string, string> = {
  active: "attivo",
  past_due: "pagamento fallito",
  unpaid: "non pagato",
  canceled: "disdetto",
  incomplete: "incompleto",
  trial: "prova",
};

function requestTime() {
  return Date.now();
}

/**
 * Aziende dei clienti: creazione da parte del team, compilazione del profilo al posto del
 * cliente e invito del titolare. Il cliente poi sceglie e paga il piano in app.
 */
export default async function AziendePage() {
  const ctx = await requireAdmin("/admin/aziende");
  const db = createAdminClient();
  const [{ data: workspaces }, { data: members }, { data: invites }, { data: admins }] =
    await Promise.all([
      db
        .from("workspaces")
        .select("id, name, city, plan_id, subscription_status, onboarding_completed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      db.from("workspace_members").select("workspace_id, user_id, role"),
      db
        .from("workspace_invitations")
        .select("workspace_id, email, role, accepted_at, revoked_at, expires_at")
        .eq("role", "owner")
        .is("accepted_at", null)
        .is("revoked_at", null),
      db.from("profiles").select("user_id").eq("is_admin", true),
    ]);
  const adminIds = new Set((admins ?? []).map((a) => a.user_id));
  const now = requestTime();

  const rows = (workspaces ?? []).map((w) => {
    const ms = (members ?? []).filter((m) => m.workspace_id === w.id);
    const owners = ms.filter((m) => m.role === "owner");
    const clientOwner = owners.some((o) => !adminIds.has(o.user_id));
    const mine = ms.find((m) => m.user_id === ctx.user.id);
    const pending = (invites ?? []).find(
      (i) => i.workspace_id === w.id && new Date(i.expires_at).getTime() > now,
    );
    return { ...w, clientOwner, mine, pending };
  });
  const managed = rows.filter((r) => r.mine);
  const others = rows.filter((r) => !r.mine);

  return (
    <PageContainer>
      <PageHeader
        title="Aziende"
        description="Crea l'azienda di un cliente, compila tu il profilo e poi invitalo come titolare: troverà tutto pronto e sceglierà il piano in app."
      />

      <Card>
        <CardHeader>
          <CardTitle>Nuova azienda per un cliente</CardTitle>
          <CardDescription>
            Si apre l&apos;onboarding di questa azienda: azienda, brand, video di esempio e giorni
            di pubblicazione. Parte con la prova di 3 video.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewClientForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aziende che segui tu</CardTitle>
          <CardDescription>
            Quelle di cui fai parte. Da qui le apri o inviti il titolare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!managed.length ? (
            <EmptyState
              icon={Building2}
              title="Nessuna azienda"
              description="Crea la prima qui sopra."
              className="py-6"
            />
          ) : (
            <ul className="divide-y">
              {managed.map((w) => (
                <li
                  key={w.id}
                  className="grid gap-3 py-4 md:grid-cols-[1fr_auto_minmax(0,22rem)] md:items-center"
                >
                  <div className="grid gap-1">
                    <span className="font-medium">{w.name}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {w.onboarding_completed_at ? (
                        <Badge variant="success">Profilo completo</Badge>
                      ) : (
                        <Badge variant="warning">Profilo da completare</Badge>
                      )}
                      {w.clientOwner ? (
                        <Badge variant="secondary">Il cliente è titolare</Badge>
                      ) : w.pending ? (
                        <Badge variant="info">Invito inviato a {w.pending.email}</Badge>
                      ) : (
                        <Badge variant="secondary">Titolare: team CP Studio</Badge>
                      )}
                      <Badge variant="secondary">
                        {w.plan_id ? `Piano ${w.plan_id}` : "Prova"}
                      </Badge>
                    </span>
                  </div>
                  <form action={adminOpenWorkspaceAction}>
                    <input type="hidden" name="workspace_id" value={w.id} />
                    <SubmitButton size="sm" variant="outline">
                      {w.onboarding_completed_at ? "Apri" : "Completa il profilo"}{" "}
                      <ArrowRight aria-hidden />
                    </SubmitButton>
                  </form>
                  {!w.clientOwner && w.mine?.role === "owner" ? (
                    w.onboarding_completed_at ? (
                      <InviteOwnerForm workspaceId={w.id} />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Completa il profilo, poi invita il titolare.
                      </p>
                    )
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tutte le altre aziende</CardTitle>
          <CardDescription>
            Registrate dai clienti. Per lavorarci serve un invito dal titolare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm">
            {others.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2"
              >
                <span>
                  {w.name}
                  {w.city && <span className="text-muted-foreground"> · {w.city}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {w.plan_id
                    ? `Piano ${w.plan_id} · ${STATUS_IT[w.subscription_status] ?? w.subscription_status}`
                    : "Prova"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
