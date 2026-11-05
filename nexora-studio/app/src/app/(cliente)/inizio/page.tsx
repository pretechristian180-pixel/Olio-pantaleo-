import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Clapperboard, FileText, Sparkles, Upload } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer } from "@/components/layout/page-header";
import { UsageMeter } from "@/components/layout/usage-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { firstName, requireWorkspace } from "@/lib/workspace";

/** Numero della settimana ISO, come sul calendario. */
function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export const metadata: Metadata = { title: "Home" };

export default async function InizioPage() {
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;
  const isTrial = !ws.plan_id;
  const trialUsed = 3 - ws.trial_videos_left;

  return (
    <PageContainer>
      {/* Benvenuto con il bagliore del brand */}
      <section className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-7">
        <div
          className="pointer-events-none absolute inset-0 bg-aurora opacity-0 dark:opacity-100"
          aria-hidden
        />
        <div className="relative grid gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="grid gap-2">
            <Badge variant="info" className="gap-1">
              <Sparkles aria-hidden />
              Settimana {isoWeek(new Date())}
            </Badge>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Ciao {firstName(ctx)}, ecco la tua settimana
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              Gira i video quando hai un momento: al montaggio e alla pubblicazione pensiamo noi.
            </p>
          </div>
          <Button variant="brand" size="lg" asChild>
            <Link href="/video/carica">
              <Upload aria-hidden />
              Carica il video
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Video da girare questa settimana</CardTitle>
            <CardDescription>
              Ogni script ha l&apos;idea, la frase d&apos;apertura e i consigli di ripresa.
            </CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/script">
                  Tutti <ArrowRight aria-hidden />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={FileText}
              title="I tuoi primi script arrivano a breve"
              description="Appena completi il profilo del brand prepariamo gli script della settimana e ti avvisiamo via email."
              action={
                <Button variant="outline" asChild>
                  <Link href="/brand">Completa il brand</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Il tuo piano</CardTitle>
            <CardDescription>{isTrial ? "Prova gratuita" : "Abbonamento attivo"}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {isTrial ? (
              <UsageMeter
                label="Video montati"
                used={trialUsed}
                total={3}
                hint={
                  ws.trial_videos_left > 0
                    ? `Ti restano ${ws.trial_videos_left} video gratuiti.`
                    : "Hai usato i video gratuiti: scegli un piano per continuare."
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Il dettaglio dei consumi arriva con la fatturazione.
              </p>
            )}
            <Button variant="secondary" asChild>
              <Link href="/piano">Scopri i piani</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Da approvare</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Clapperboard}
              title="Nessun video da approvare"
              description="Quando un video è montato lo trovi qui e ricevi un'email."
              className="py-8"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prossimi post</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={CalendarClock}
              title="Nessun post in programma"
              description="I video approvati entrano nel calendario nei giorni e negli orari che hai scelto."
              className="py-8"
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
