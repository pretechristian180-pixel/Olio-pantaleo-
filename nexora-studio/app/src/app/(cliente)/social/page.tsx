import type { Metadata } from "next";
import { CheckCircle2, ExternalLink, Link2, RefreshCw, TriangleAlert } from "lucide-react";
import type { SocialPlatform } from "@nexora/shared";

import { SubmitButton } from "@/components/forms/submit-button";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  refreshSocialAction,
  requestConnectLinkAction,
  toggleSocialAction,
} from "@/lib/actions/calendar";
import { PLATFORM_LABELS } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Social" };

const ORDER: SocialPlatform[] = ["instagram", "facebook", "tiktok", "youtube", "linkedin"];
const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function SocialPage(props: PageProps<"/social">) {
  const { limite } = await props.searchParams;
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;
  const isOwner = ctx.active.role === "owner";
  const supabase = await createClient();
  const [{ data: accounts }, { data: plan }] = await Promise.all([
    supabase.from("social_accounts").select("*").eq("workspace_id", ws.id),
    ws.plan_id
      ? supabase.from("plans").select("name, social_accounts_max").eq("id", ws.plan_id).single()
      : Promise.resolve({ data: null }),
  ]);
  const byPlatform = new Map((accounts ?? []).map((a) => [a.platform, a]));
  const linkValid =
    ws.metricool_connect_url &&
    ws.metricool_connect_expires &&
    new Date(ws.metricool_connect_expires) > new Date();
  const connectedCount = (accounts ?? []).filter((a) => a.status === "connected").length;
  const lastCheck = (accounts ?? [])
    .map((a) => a.last_checked_at)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Social"
        description="Gli account su cui pubblichiamo i tuoi video. Pubblichiamo solo i video che approvi."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Collega i tuoi social</CardTitle>
          <CardDescription>
            Si apre una pagina sicura del nostro partner di pubblicazione (Metricool): accedi a
            ciascun social e autorizza la pubblicazione. Non ti serve un account Metricool.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {linkValid ? (
            <Button variant="brand" size="lg" asChild>
              <a href={ws.metricool_connect_url!} target="_blank" rel="noopener noreferrer">
                <Link2 aria-hidden /> Collega i social{" "}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          ) : (
            <form action={requestConnectLinkAction} className="grid gap-2">
              <input type="hidden" name="workspace_id" value={ws.id} />
              <p className="text-sm text-muted-foreground">
                Il link per collegare i social lo prepara il nostro team ed è valido 3 giorni.
              </p>
              <SubmitButton variant="brand" size="lg" pendingLabel="Invio…">
                Chiedi il link per collegare i social
              </SubmitButton>
            </form>
          )}
          <form
            action={refreshSocialAction}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <input type="hidden" name="workspace_id" value={ws.id} />
            <span className="text-xs text-muted-foreground">
              {lastCheck
                ? `Ultimo controllo: ${dateFmt.format(new Date(lastCheck))}`
                : "Non ancora controllati"}
            </span>
            <SubmitButton variant="ghost" size="sm" pendingLabel="Aggiorno…">
              <RefreshCw aria-hidden /> Ho collegato, aggiorna
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      {plan && (limite || connectedCount > plan.social_accounts_max) && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertTitle>
            {limite ? "Hai già incluso tutti i social del piano" : "Hai più social del tuo piano"}
          </AlertTitle>
          <AlertDescription>
            Il piano {plan.name} include {plan.social_accounts_max} social per brand: quelli in più
            restano collegati ma non li usiamo. Escludine uno per includerne un altro, oppure{" "}
            <a href="/piano" className="font-medium underline underline-offset-4">
              passa a un piano superiore
            </a>
            .
          </AlertDescription>
        </Alert>
      )}

      <ul className="grid gap-3">
        {ORDER.map((platform) => {
          const a = byPlatform.get(platform);
          const connected = a?.status === "connected";
          return (
            <li
              key={platform}
              className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-sm font-bold text-primary-text">
                {PLATFORM_LABELS[platform].slice(0, 2)}
              </span>
              <div className="grid min-w-36 flex-1">
                <span className="font-medium">{PLATFORM_LABELS[platform]}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {connected
                    ? (a?.handle ?? "Collegato")
                    : a?.status === "expired"
                      ? "Collegamento scaduto: ricollegalo"
                      : "Non collegato"}
                </span>
              </div>
              {connected ? (
                <Badge variant={a!.enabled ? "success" : "secondary"}>
                  <CheckCircle2 aria-hidden /> {a!.enabled ? "Pubblichiamo qui" : "Escluso"}
                </Badge>
              ) : (
                <Badge variant={a ? "warning" : "outline"}>
                  {a ? "Da ricollegare" : "Non collegato"}
                </Badge>
              )}
              {connected && isOwner && (
                <form action={toggleSocialAction}>
                  <input type="hidden" name="account_id" value={a!.id} />
                  <Button size="sm" variant="ghost" type="submit">
                    {a!.enabled ? "Escludi" : "Includi"}
                  </Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </PageContainer>
  );
}
