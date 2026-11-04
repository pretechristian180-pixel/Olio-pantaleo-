import { useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { teamDashboard } from "@/services/team";
import type { AgentStats } from "@/types/team";

type Period = "7" | "30" | "90";
const periodLabel: Record<Period, string> = { "7": "negli ultimi 7 giorni", "30": "negli ultimi 30 giorni", "90": "negli ultimi 3 mesi" };

/** Squadra: chi sta facendo cosa. Il titolare vede tutti, l'agente solo i propri numeri. */
export function TeamPage() {
  const { isOwner } = useAuth();
  const [period, setPeriod] = useState<Period>("7");
  const { data, loading, error, reload } = useQuery(() => teamDashboard(Number(period)), [period]);
  const total = (k: keyof AgentStats) => (data ?? []).reduce((s, a) => s + (Number(a[k]) || 0), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={isOwner ? "La squadra" : "I miei numeri"} subtitle={isOwner ? "Chi sta facendo cosa: chiamate, visite, incarichi e cose da fare" : "Il tuo lavoro in numeri"} />
      <Segmented
        label="Periodo"
        value={period}
        onChange={setPeriod}
        className="mb-5 sm:max-w-sm"
        options={[
          { value: "7", label: "7 giorni" },
          { value: "30", label: "30 giorni" },
          { value: "90", label: "3 mesi" },
        ]}
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : (
        <div className="space-y-4">
          {isOwner && data.length > 1 && (
            <Card>
              <CardContent className="py-5">
                <p className="mb-3 text-[15px] font-medium text-muted-foreground">Tutta l'agenzia {periodLabel[period]}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Big value={total("calls") + total("messages")} label="chiamate e messaggi" />
                  <Big value={total("visits")} label="visite fatte" />
                  <Big value={total("mandates")} label="incarichi firmati" />
                  <Big value={total("offers") + total("closings")} label="proposte e rogiti" />
                </div>
              </CardContent>
            </Card>
          )}
          {data.map((a) => (
            <AgentCard key={a.agentId} a={a} period={period} />
          ))}
          <p className="text-sm text-muted-foreground">
            I numeri vengono da quello che si registra in Mattonio: chiamate e WhatsApp fatti dai pulsanti dell'app, appuntamenti in agenda, fasi di trattative e acquisizioni.
          </p>
        </div>
      )}
    </div>
  );
}

function Big({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-3">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function AgentCard({ a, period }: { a: AgentStats; period: Period }) {
  const stats: [number | string, string][] = [
    [a.calls, "chiamate"],
    [a.messages, "WhatsApp ed email"],
    [a.visits, "visite fatte"],
    [a.newContacts, "nuovi contatti"],
    [a.leads, "lead ricevuti"],
    [a.leadResponseMinutes == null ? "—" : a.leadResponseMinutes < 60 ? `${a.leadResponseMinutes} min` : `${Math.round(a.leadResponseMinutes / 60)} ore`, "tempo di risposta ai lead"],
    [a.mandates, "incarichi firmati"],
    [a.offers + a.closings, "proposte e rogiti"],
  ];
  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">
            {a.name}
            {a.role === "titolare" && <span className="ml-2 text-[15px] font-medium text-muted-foreground">titolare</span>}
          </h2>
          <p className="text-[15px] text-muted-foreground">{a.lastActivity ? `Ultima attività ${formatRelative(a.lastActivity)}` : "Nessuna attività registrata"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map(([v, l]) => (
            <div key={l} className="rounded-lg border px-3 py-2">
              <p className="text-xl font-bold tabular-nums">{v}</p>
              <p className="text-sm text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
        <Link
          to={`/attivita?agente=${a.agentId}`}
          className={cn("flex min-h-12 items-center gap-3 rounded-lg px-4", a.tasksLate ? "bg-red-50 text-red-900" : "bg-muted")}
        >
          {a.tasksLate > 0 && <AlarmClock className="size-5 shrink-0" aria-hidden />}
          <span className="flex-1 text-[15px]">
            <strong>{a.tasksOpen}</strong> cose da fare aperte{a.tasksLate > 0 ? `, ${a.tasksLate} in ritardo` : ""} · <strong>{a.tasksDone}</strong> fatte {periodLabel[period]}
            {a.upcoming > 0 ? ` · ${a.upcoming} appuntamenti nei prossimi 7 giorni` : ""}
          </span>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
