import type { Metadata } from "next";
import { Clock, LogOut, UserMinus, Users } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { changeRole, removeMember, revokeInvitation } from "@/lib/actions/team";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

import { InviteForm } from "./invite-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Team" };

const roleLabel = { owner: "Titolare", member: "Collaboratore" } as const;
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

export default async function TeamPage() {
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;
  const isOwner = ctx.active.role === "owner";
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, role, joined_at")
    .eq("workspace_id", ws.id)
    .order("joined_at");
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("user_id, full_name").in("user_id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? "Senza nome"]));
  const ownerCount = (members ?? []).filter((m) => m.role === "owner").length;

  const { data: invitations } = isOwner
    ? await supabase
        .from("workspace_invitations")
        .select("id, email, role, expires_at")
        .eq("workspace_id", ws.id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Team" description={`Le persone di ${ws.name} che usano Nexora Studio.`} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Persone</CardTitle>
          <CardDescription>
            I titolari gestiscono tutto, anche piano e fatturazione. I collaboratori caricano i
            video, li approvano e vedono il calendario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-xl border">
            {(members ?? []).map((m) => {
              const name = names.get(m.user_id) ?? "Senza nome";
              const isMe = m.user_id === ctx.user.id;
              const lastOwner = m.role === "owner" && ownerCount <= 1;
              return (
                <li
                  key={m.user_id}
                  className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap"
                >
                  <Avatar>
                    <AvatarFallback>{initials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">
                      {name} {isMe && <span className="text-muted-foreground">(tu)</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Nel team dal {dateFmt.format(new Date(m.joined_at))}
                    </span>
                  </div>
                  <Badge variant={m.role === "owner" ? "info" : "secondary"}>
                    {roleLabel[m.role]}
                  </Badge>
                  {isOwner && !isMe && (
                    <div className="flex gap-1">
                      <form action={changeRole}>
                        <input type="hidden" name="workspace_id" value={ws.id} />
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <input
                          type="hidden"
                          name="role"
                          value={m.role === "owner" ? "member" : "owner"}
                        />
                        <Button size="sm" variant="ghost" type="submit" disabled={lastOwner}>
                          {m.role === "owner" ? "Rendi collaboratore" : "Rendi titolare"}
                        </Button>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="workspace_id" value={ws.id} />
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          type="submit"
                          aria-label={`Rimuovi ${name}`}
                          disabled={lastOwner}
                        >
                          <UserMinus aria-hidden />
                        </Button>
                      </form>
                    </div>
                  )}
                  {isMe && !lastOwner && (
                    <form action={removeMember}>
                      <input type="hidden" name="workspace_id" value={ws.id} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <Button size="sm" variant="ghost" type="submit">
                        <LogOut aria-hidden /> Esci dal team
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          {(members ?? []).length === 1 && (
            <EmptyState
              icon={Users}
              title="Lavori da solo, per ora"
              description="Invita un collaboratore: potrà caricare i video, approvarli e vedere il calendario."
              className="mt-4 border-0 py-6"
            />
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invita qualcuno</CardTitle>
            <CardDescription>
              Riceverà un&apos;email con il link per entrare. L&apos;invito vale 7 giorni.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <InviteForm workspaceId={ws.id} />
            {(invitations ?? []).length > 0 && (
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">Inviti in attesa</h3>
                <ul className="divide-y rounded-xl border">
                  {(invitations ?? []).map((inv) => (
                    <li key={inv.id} className="flex items-center gap-3 p-3">
                      <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="grid min-w-0 flex-1">
                        <span className="truncate text-sm">{inv.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {roleLabel[inv.role]} · scade il{" "}
                          {dateFmt.format(new Date(inv.expires_at))}
                        </span>
                      </div>
                      <form action={revokeInvitation}>
                        <input type="hidden" name="workspace_id" value={ws.id} />
                        <input type="hidden" name="invitation_id" value={inv.id} />
                        <Button size="sm" variant="ghost" type="submit">
                          Annulla
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Il tuo profilo</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            fullName={ctx.profile?.full_name ?? ""}
            phone={ctx.profile?.phone ?? ""}
            email={ctx.user.email}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
