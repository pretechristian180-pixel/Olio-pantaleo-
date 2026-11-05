import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Clock, TriangleAlert } from "lucide-react";

import { BarChart } from "@/components/admin/bar-chart";
import { StatTile } from "@/components/admin/stat-tile";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AutoRefresh } from "@/components/scripts/auto-refresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { eur, getDashboard, requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

const dayFmt = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});
const whenFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const mins = (v: number | null) => (v === null ? "—" : `${v.toFixed(v < 10 ? 1 : 0)} min`);

/** Dashboard del team: ricavi, clienti, produzione, tempi, costi e salute della coda. */
export default async function AdminDashboard() {
  await requireAdmin();
  const d = await getDashboard();
  const workerStuck = d.jobs.queued > 0 && d.jobs.oldestQueuedMin >= 5 && d.jobs.running === 0;

  return (
    <PageContainer>
      <AutoRefresh seconds={60} />
      <PageHeader
        title="Dashboard"
        description="Ultimi 30 giorni. I costi dei fornitori sono convertiti da dollari, indicativi."
      />

      {workerStuck && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>Il worker sembra fermo</AlertTitle>
          <AlertDescription>
            {d.jobs.queued} job in coda, il più vecchio aspetta da {d.jobs.oldestQueuedMin} minuti e
            nessuno è in lavorazione. Controlla il servizio su Railway.{" "}
            <Link href="/admin/job?stato=queued" className="underline underline-offset-4">
              Vedi la coda
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {d.pastDue.length > 0 && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertTitle>
            {d.pastDue.length === 1
              ? "1 azienda con pagamento fallito"
              : `${d.pastDue.length} aziende con pagamento fallito`}
          </AlertTitle>
          <AlertDescription>
            {d.pastDue.map((w) => w.name).join(", ")}: i nuovi montaggi sono in pausa.
          </AlertDescription>
        </Alert>
      )}

      <section aria-label="Ricavi e clienti" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Ricavi ricorrenti (mese)"
          value={eur(d.mrrEur, 0)}
          note="Prezzi di listino, IVA esclusa"
        />
        <StatTile
          label="Aziende abbonate"
          value={String(d.paying)}
          note={d.byPlan.map((p) => `${p.name} ${p.count}`).join(" · ")}
        />
        <StatTile label="In prova gratuita" value={String(d.trials)} note="Onboarding completato" />
        <StatTile
          label="Margine indicativo"
          value={eur(d.marginEur, 0)}
          note={`Ricavi del mese meno ${eur(d.costs30Eur, d.costs30Eur < 10 ? 2 : 0)} di costi`}
          tone={d.marginEur >= 0 ? "default" : "critical"}
          icon={d.marginEur >= 0 ? undefined : TriangleAlert}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Video caricati al giorno</CardTitle>
            <CardDescription>
              Ultimi 14 giorni · {d.videos30} nei 30 giorni, {d.rendered30} montati
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              label="Video caricati al giorno"
              unit="video"
              data={d.perDay.map((p) => ({
                key: p.day,
                label: dayFmt.format(new Date(`${p.day}T12:00:00Z`)),
                value: p.count,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tempi di montaggio</CardTitle>
            <CardDescription>
              Dal caricamento alla prima versione pronta. Obiettivo: meno di 15 minuti.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <StatTile label="Mediana" value={mins(d.medianMinutes)} />
            <StatTile label="9 video su 10 entro" value={mins(d.p90Minutes)} />
            <div className="col-span-2">
              <StatTile
                label="Pronti entro 15 minuti"
                value={pct(d.under15)}
                tone={d.under15 === null ? "default" : d.under15 >= 0.9 ? "good" : "warning"}
                icon={d.under15 === null ? undefined : d.under15 >= 0.9 ? CheckCircle2 : Clock}
                note={
                  d.under15 === null
                    ? "Ancora nessun video montato"
                    : d.under15 >= 0.9
                      ? "In linea con l'obiettivo"
                      : "Sotto l'obiettivo del 90%"
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <section aria-label="Costi e coda" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Costo medio per video"
          value={d.avgVideoEur === null ? "—" : eur(d.avgVideoEur)}
          note="Trascrizione, montaggio AI, b-roll, render"
        />
        <StatTile
          label="Costi fornitori (30 gg)"
          value={eur(d.costs30Eur)}
          note={
            <Link href="/admin/costi" className="underline underline-offset-4">
              Dettaglio per video
            </Link>
          }
        />
        <StatTile
          label="Coda dei job"
          value={`${d.jobs.queued} in coda`}
          note={`${d.jobs.running} in lavorazione`}
          tone={workerStuck ? "critical" : "default"}
          icon={workerStuck ? CircleAlert : undefined}
        />
        <StatTile
          label="Job falliti (24 ore)"
          value={String(d.jobs.failed24)}
          note={d.jobs.failed24 ? "Da controllare" : "Nessun errore"}
          tone={d.jobs.failed24 ? "critical" : "good"}
          icon={d.jobs.failed24 ? CircleAlert : CheckCircle2}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Da controllare</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Link
              href="/admin/revisione"
              className="flex items-center justify-between rounded-lg border bg-background/40 p-3 hover:border-nx-blue-500/50"
            >
              Video in revisione interna{" "}
              <strong className="tabular-nums">{d.internalReview}</strong>
            </Link>
            <Link
              href="/admin/job?stato=failed"
              className="flex items-center justify-between rounded-lg border bg-background/40 p-3 hover:border-nx-blue-500/50"
            >
              Job falliti nelle ultime 24 ore{" "}
              <strong className="tabular-nums">{d.jobs.failed24}</strong>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Video in errore (7 giorni)</CardTitle>
          </CardHeader>
          <CardContent>
            {d.errors.length ? (
              <ul className="grid gap-2 text-sm">
                {d.errors.map((e) => (
                  <li key={e.id} className="rounded-lg border bg-background/40 p-3">
                    <span className="font-medium">{e.workspace}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {whenFmt.format(new Date(e.at))}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {e.error ?? "Errore"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" aria-hidden /> Nessun video in errore.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
