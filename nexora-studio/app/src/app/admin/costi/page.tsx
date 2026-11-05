import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";

import { StatTile } from "@/components/admin/stat-tile";
import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  eur,
  getVideoCosts,
  OPERATION_LABELS,
  requireAdmin,
  USD_EUR,
  VIDEO_OPERATIONS,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Costi", robots: { index: false } };

const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Rome",
});
const PERIODS = [7, 30, 90] as const;
const money = (v: number | undefined) => (v ? eur(v, v < 0.1 ? 3 : 2) : "—");

/** Costo di ogni montaggio (trascrizione, LLM, b-roll, render, pubblicazione) e per azienda. */
export default async function CostiPage(props: PageProps<"/admin/costi">) {
  await requireAdmin("/admin/costi");
  const sp = await props.searchParams;
  const days = PERIODS.find((p) => String(p) === sp.giorni) ?? 30;
  const c = await getVideoCosts(days);
  const totalVideo = Object.values(c.totals).reduce((a, b) => a + b, 0);
  const totalOther = Object.values(c.nonVideo).reduce((a, b) => a + b, 0);

  return (
    <PageContainer>
      <PageHeader
        title="Costi"
        description={`Costi dei fornitori registrati per ogni operazione, in euro al cambio indicativo di ${USD_EUR} € per dollaro.`}
      />
      <nav aria-label="Periodo" className="flex gap-2 text-sm">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/admin/costi?giorni=${p}`}
            aria-current={p === days ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 font-medium",
              p === days
                ? "border-nx-blue-500/60 bg-accent"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p} giorni
          </Link>
        ))}
      </nav>

      <section aria-label="Riepilogo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Costo medio per video montato"
          value={c.avg === null ? "—" : eur(c.avg, 3)}
        />
        <StatTile label="Video più costoso" value={c.max === null ? "—" : eur(c.max, 3)} />
        <StatTile label="Totale video" value={eur(totalVideo)} note={`${c.list.length} video`} />
        <StatTile
          label="Fuori dai video"
          value={eur(totalOther)}
          note={
            Object.entries(c.nonVideo)
              .map(([k, v]) => `${OPERATION_LABELS[k] ?? k} ${eur(v)}`)
              .join(" · ") || "Nessuno"
          }
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Per video</CardTitle>
          <CardDescription>
            Ogni riga somma tutte le versioni del video (anche le modifiche richieste).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!c.list.length ? (
            <EmptyState
              icon={Receipt}
              title="Nessun costo nel periodo"
              description="I costi compaiono appena un video viene montato."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 font-medium">Video</th>
                    {VIDEO_OPERATIONS.map((op) => (
                      <th key={op} className="px-2 py-2 text-right font-medium">
                        {OPERATION_LABELS[op]}
                      </th>
                    ))}
                    <th className="py-2 pl-2 text-right font-medium">Totale</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {c.list.map((r) => (
                    <tr key={r.videoId} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <span className="block font-medium">{r.workspace}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.title} · {dateFmt.format(new Date(r.last))}
                          {r.versions > 1 && ` · ${r.versions} versioni`}
                        </span>
                      </td>
                      {VIDEO_OPERATIONS.map((op) => (
                        <td key={op} className="px-2 py-2 text-right text-muted-foreground">
                          {money(r.ops[op])}
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-right font-semibold">{eur(r.total, 3)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="tabular-nums">
                  <tr>
                    <td className="py-2 pr-3 font-medium">Totale</td>
                    {VIDEO_OPERATIONS.map((op) => (
                      <td key={op} className="px-2 py-2 text-right font-medium">
                        {money(c.totals[op])}
                      </td>
                    ))}
                    <td className="py-2 pl-2 text-right font-semibold">{eur(totalVideo)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {c.byWorkspace.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aziende che costano di più</CardTitle>
            <CardDescription>Video e script, nel periodo.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm tabular-nums">
              {c.byWorkspace.map((w) => (
                <li key={w.id} className="flex justify-between border-b border-border/60 py-1.5">
                  <span>{w.name}</span>
                  <span className="font-medium">{eur(w.total)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
