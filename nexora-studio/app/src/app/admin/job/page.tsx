import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Clock, Loader2 } from "lucide-react";

import { JobActions } from "@/components/admin/job-actions";
import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AutoRefresh } from "@/components/scripts/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Tables } from "@nexora/shared";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Job", robots: { index: false } };

const TYPE_LABELS: Record<string, string> = {
  generate_scripts: "Script della settimana",
  send_email: "Email",
  transcribe: "Trascrizione",
  edit: "Montaggio AI",
  render: "Render",
  publish: "Pubblicazione",
  sync_social: "Sincronizzazione social",
};
const STATUS = {
  queued: { label: "In coda", variant: "secondary", icon: Clock },
  running: { label: "In lavorazione", variant: "info", icon: Loader2 },
  done: { label: "Completato", variant: "success", icon: CheckCircle2 },
  failed: { label: "Fallito", variant: "destructive", icon: CircleAlert },
} as const;
type Status = keyof typeof STATUS;
type JobType = Tables<"jobs">["type"];

/** Istante della richiesta (fuori dal render per la regola di purezza). */
function requestTime() {
  return Date.now();
}

const whenFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Rome",
});
function duration(from: string, to: string | null) {
  if (!to) return null;
  const s = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  return s < 90 ? `${s} s` : `${Math.round(s / 60)} min`;
}

/** Monitor della coda: filtri per stato e tipo, errori, riprova e annulla. */
export default async function JobsPage(props: PageProps<"/admin/job">) {
  await requireAdmin("/admin/job");
  const sp = await props.searchParams;
  const stato = typeof sp.stato === "string" && sp.stato in STATUS ? (sp.stato as Status) : null;
  const tipo = typeof sp.tipo === "string" && sp.tipo in TYPE_LABELS ? sp.tipo : null;

  const db = createAdminClient();
  let query = db.from("jobs").select("*").order("created_at", { ascending: false }).limit(100);
  if (stato) query = query.eq("status", stato);
  if (tipo) query = query.eq("type", tipo as JobType);
  const [{ data: jobs }, ...counts] = await Promise.all([
    query,
    ...(Object.keys(STATUS) as Status[]).map((s) =>
      db.from("jobs").select("id", { count: "exact", head: true }).eq("status", s),
    ),
  ]);
  const countOf = Object.fromEntries(
    (Object.keys(STATUS) as Status[]).map((s, i) => [s, counts[i]?.count ?? 0]),
  );
  const href = (p: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const next = { stato, tipo, ...p };
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/admin/job?${s}` : "/admin/job";
  };
  const wsIds = [
    ...new Set((jobs ?? []).map((j) => j.workspace_id).filter((x): x is string => Boolean(x))),
  ];
  const { data: names } = wsIds.length
    ? await db.from("workspaces").select("id, name").in("id", wsIds)
    : { data: [] as { id: string; name: string }[] };
  const wsName = new Map((names ?? []).map((w) => [w.id, w.name]));
  const now = requestTime();

  return (
    <PageContainer>
      <AutoRefresh seconds={15} />
      <PageHeader
        title="Job"
        description="La coda del worker: ogni job viene ritentato da solo fino a 3 volte (dopo 1, 4 e 16 minuti). Si aggiorna ogni 15 secondi."
      />

      <div className="grid gap-3">
        <nav aria-label="Filtra per stato" className="flex flex-wrap gap-2 text-sm">
          <FilterLink href={href({ stato: null })} active={!stato}>
            Tutti
          </FilterLink>
          {(Object.keys(STATUS) as Status[]).map((s) => (
            <FilterLink key={s} href={href({ stato: s })} active={stato === s}>
              {STATUS[s].label}{" "}
              <span className="text-muted-foreground tabular-nums">{countOf[s]}</span>
            </FilterLink>
          ))}
        </nav>
        <nav aria-label="Filtra per tipo" className="flex flex-wrap gap-2 text-xs">
          <FilterLink href={href({ tipo: null })} active={!tipo} small>
            Ogni tipo
          </FilterLink>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <FilterLink key={k} href={href({ tipo: k })} active={tipo === k} small>
              {v}
            </FilterLink>
          ))}
        </nav>
      </div>

      {!jobs?.length ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nessun job"
          description="Con questi filtri non c'è niente da mostrare."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {jobs.map((j) => {
                const st = STATUS[j.status as Status];
                const Icon = st.icon;
                const waiting = j.status === "queued" && new Date(j.run_after).getTime() > now;
                return (
                  <li key={j.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={st.variant} className="gap-1">
                          <Icon
                            className={cn(j.status === "running" && "animate-spin")}
                            aria-hidden
                          />
                          {st.label}
                        </Badge>
                        <span className="font-medium">{TYPE_LABELS[j.type] ?? j.type}</span>
                        <span className="text-sm text-muted-foreground">
                          {(j.workspace_id && wsName.get(j.workspace_id)) || "Sistema"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Creato {whenFmt.format(new Date(j.created_at))} · tentativi {j.attempts}/
                        {j.max_attempts}
                        {duration(j.created_at, j.finished_at) &&
                          ` · durata ${duration(j.created_at, j.finished_at)}`}
                        {waiting && ` · riparte ${whenFmt.format(new Date(j.run_after))}`}
                        {j.locked_by && j.status === "running" && ` · ${j.locked_by}`}
                      </p>
                      {j.last_error && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-destructive">
                            {j.last_error.split("\n")[0]!.slice(0, 140)}
                          </summary>
                          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-2 whitespace-pre-wrap">
                            {j.last_error}
                            {"\n\n"}payload: {JSON.stringify(j.payload)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <JobActions jobId={j.id} status={j.status} type={j.type} />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">Ultimi 100 job con questi filtri.</p>
    </PageContainer>
  );
}

function FilterLink({
  href,
  active,
  small,
  children,
}: {
  href: string;
  active: boolean;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 font-medium transition-colors",
        small && "px-2.5 py-0.5",
        active
          ? "border-nx-blue-500/60 bg-accent text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
