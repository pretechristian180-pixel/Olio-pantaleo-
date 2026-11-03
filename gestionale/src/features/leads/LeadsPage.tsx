import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { AlarmClock, ChevronRight, Home, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { cn } from "@/lib/utils";
import { leadStats, listLeads } from "@/services/leads";
import type { Lead } from "@/types/leads";
import { isLate, scoreLevel, since, sourceLabel, stateLabel } from "./labels";

/** Contatti | Lead: le due schede della sezione Contatti */
export function ContactsTabs({ newLeads }: { newLeads?: number }) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 text-[15px] font-semibold transition-colors",
      isActive ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <nav aria-label="Sezione contatti" className="mb-5 flex rounded-lg bg-muted p-1 sm:max-w-sm">
      <NavLink to="/contatti" end className={tab}>
        Contatti
      </NavLink>
      <NavLink to="/contatti/lead" className={tab}>
        Lead
        {!!newLeads && <span className="rounded-full bg-primary px-2 py-0.5 text-sm font-bold tabular-nums text-white">{newLeads}</span>}
      </NavLink>
    </nav>
  );
}

/** Conteggio dei lead da richiamare, per il badge della scheda */
export function useNewLeadsCount() {
  const { data } = useQuery(listLeads);
  return data?.filter((l) => l.state === "nuovo").length;
}

type Vista = "da_gestire" | "in_corso" | "chiusi";
const inVista = (l: Lead, v: Vista) =>
  v === "da_gestire" ? l.state === "nuovo" : v === "in_corso" ? l.state === "contattato" || l.state === "appuntamento" : ["acquisito", "perso", "spam"].includes(l.state);

/** Casella unica dei lead: sito, portali, Facebook e Instagram */
export function LeadsPage() {
  const { isOwner } = useAuth();
  const { data, loading, error, reload } = useQuery(listLeads);
  const stats = useQuery(leadStats);
  const [vista, setVista] = useState<Vista>("da_gestire");
  const count = (v: Vista) => data?.filter((l) => inVista(l, v)).length;
  // Da richiamare: prima quelli in ritardo, poi i più caldi
  const items = (data ?? [])
    .filter((l) => inVista(l, vista))
    .sort((a, b) => (vista === "da_gestire" ? Number(isLate(b)) - Number(isLate(a)) || b.score - a.score : 0));

  return (
    <div>
      <PageHeader
        title="Contatti"
        subtitle="Le richieste che arrivano da sito, portali e social"
        action={
          isOwner ? (
            <Button variant="outline" size="lg" asChild>
              <Link to="/impostazioni/lead">
                <Settings2 aria-hidden />
                Da dove arrivano
              </Link>
            </Button>
          ) : undefined
        }
      />
      <ContactsTabs newLeads={count("da_gestire")} />

      {stats.data && stats.data.total > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2">
          <Stat value={String(stats.data.total)} label="lead in 30 giorni" />
          <Stat value={stats.data.medianResponseMinutes == null ? "—" : `${stats.data.medianResponseMinutes} min`} label="tempo di risposta" />
          <Stat value={String(stats.data.appointments)} label="appuntamenti fissati" />
        </div>
      )}

      <Segmented
        label="Quali lead"
        value={vista}
        onChange={setVista}
        className="mb-5 sm:max-w-md"
        options={[
          { value: "da_gestire", label: "Da richiamare", count: count("da_gestire") },
          { value: "in_corso", label: "In corso", count: count("in_corso") },
          { value: "chiusi", label: "Chiusi", count: count("chiusi") },
        ]}
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          art={vista === "da_gestire" ? "fatto" : "persone"}
          title={vista === "da_gestire" ? "Nessun lead da richiamare" : vista === "in_corso" ? "Nessun lead in corso" : "Nessun lead chiuso"}
          text={
            vista === "da_gestire"
              ? isOwner
                ? "Quando arriva una richiesta dal sito, dai portali o dai social la trovi qui, con il punteggio e l'agente a cui è stata assegnata."
                : "Quando ti viene assegnata una nuova richiesta la trovi qui."
              : undefined
          }
          action={
            vista === "da_gestire" && isOwner && !data?.length ? (
              <Button size="lg" asChild>
                <Link to="/impostazioni/lead">Collega sito, portali e social</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((l) => (
            <li key={l.id}>
              <LeadCard lead={l} showAgent={isOwner} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function LeadCard({ lead: l, showAgent }: { lead: Lead; showAgent?: boolean }) {
  const level = scoreLevel(l.score);
  const late = isLate(l);
  return (
    <Link
      to={`/contatti/lead/${l.id}`}
      className={cn("block rounded-lg border bg-card p-4 shadow-card hover:border-primary/40", late && "border-red-300")}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-semibold">
              {l.firstName} {l.lastName}
            </span>
            <Badge tone={level.tone}>
              {level.label} · {l.score}
            </Badge>
          </div>
          <p className="mt-0.5 text-[15px] text-muted-foreground">
            {sourceLabel(l)} · {since(l.createdAt)}
            {l.repeated > 1 ? ` · ha scritto ${l.repeated} volte` : ""}
            {showAgent && l.agentName ? ` · ${l.agentName}` : ""}
          </p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      {l.message && <p className="mt-2 line-clamp-2 text-[15px]">{l.message}</p>}
      {l.propertyLabel && (
        <p className="mt-2 flex items-center gap-1.5 text-[15px] text-muted-foreground">
          <Home className="size-4" aria-hidden />
          {l.propertyLabel}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {l.state !== "nuovo" && <Badge tone={stateLabel[l.state].tone}>{stateLabel[l.state].label}</Badge>}
        {late && (
          <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-red-700">
            <AlarmClock className="size-4" aria-hidden />
            Nessuno ha risposto da {since(l.createdAt).replace(" fa", "")}
          </span>
        )}
      </div>
    </Link>
  );
}
