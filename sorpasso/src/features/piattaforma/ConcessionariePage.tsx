import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Clock, Plus, Search, ShieldOff, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, ListSkeleton } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { numero, relativo } from "@/lib/format";
import { PIANI, STATI_ORG, giorniProva, useOrganizzazioni, type OrgRiga, type StatoOrg } from "./api";

type Filtro = "tutte" | StatoOrg;

export function BadgeStato({ org }: { org: Pick<OrgRiga, "stato" | "prova_fino_al"> }) {
  const s = STATI_ORG[org.stato];
  const g = org.stato === "prova" ? giorniProva(org.prova_fino_al) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={g !== null && g < 0 ? "red" : s.tone} size="sm">
        {g !== null && g < 0 ? "Prova scaduta" : s.label}
      </Badge>
      {g !== null && g >= 0 && (
        <span className={g <= 3 ? "text-xs font-semibold text-warning" : "text-xs text-muted-foreground"}>
          {g === 0 ? "scade oggi" : `ancora ${g} gg`}
        </span>
      )}
    </span>
  );
}

export default function ConcessionariePage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useOrganizzazioni();
  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [cerca, setCerca] = useState("");

  const conteggi = useMemo(() => {
    const c = { tutte: 0, attiva: 0, prova: 0, sospesa: 0, disdetta: 0 } as Record<Filtro, number>;
    for (const o of data ?? []) {
      c.tutte++;
      c[o.stato]++;
    }
    return c;
  }, [data]);

  const visibili = useMemo(() => {
    const t = cerca.trim().toLowerCase();
    return (data ?? []).filter(
      (o) =>
        (filtro === "tutte" || o.stato === filtro) &&
        (!t || [o.nome, o.comune, o.piva, o.titolare_nome, o.titolare_email].some((x) => x?.toLowerCase().includes(t))),
    );
  }, [data, filtro, cerca]);

  const inScadenza = (data ?? []).filter((o) => {
    const g = o.stato === "prova" ? giorniProva(o.prova_fino_al) : null;
    return g !== null && g <= 7;
  }).length;
  const utenti = (data ?? []).reduce((n, o) => n + o.utenti_attivi, 0);

  return (
    <div>
      <PageHeader
        title="Concessionarie"
        subtitle="Clienti di Sorpasso AI: accessi, piani, prove e stato dell'abbonamento."
        action={
          <Button asChild variant="accent">
            <Link to="/piattaforma/nuova">
              <Plus aria-hidden /> Nuova concessionaria
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Building2 />} value={conteggi.attiva} label="Attive" tone="green" />
        <StatCard icon={<Clock />} value={conteggi.prova} label="In prova" hint={inScadenza ? `${inScadenza} in scadenza entro 7 giorni` : undefined} tone="accent" />
        <StatCard icon={<ShieldOff />} value={conteggi.sospesa} label="Sospese" tone="red" />
        <StatCard icon={<Users />} value={numero(utenti)} label="Utenti attivi" tone="blue" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Cerca concessionaria"
            placeholder="Cerca nome, comune, P.IVA, titolare…"
            className="pl-11"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
          />
        </div>
        <Segmented
          label="Filtra per stato"
          className="overflow-x-auto lg:flex-1"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: "tutte", label: "Tutte", count: conteggi.tutte },
            { value: "attiva", label: "Attive", count: conteggi.attiva },
            { value: "prova", label: "In prova", count: conteggi.prova },
            { value: "sospesa", label: "Sospese", count: conteggi.sospesa },
            { value: "disdetta", label: "Disdette", count: conteggi.disdetta },
          ]}
        />
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.length ? (
        <EmptyState
          art="auto"
          title="Nessuna concessionaria ancora"
          text="Crea la prima concessionaria: il titolare riceve l'invito e può iniziare subito."
          action={
            <Button asChild variant="accent">
              <Link to="/piattaforma/nuova">Crea la prima concessionaria</Link>
            </Button>
          }
        />
      ) : !visibili.length ? (
        <EmptyState art="ricerca" title="Nessun risultato" text="Prova a cambiare ricerca o filtro." compact />
      ) : (
        <>
          {/* Desktop: tabella */}
          <div className="hidden overflow-hidden rounded-lg border bg-card shadow-card lg:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b bg-muted/60 text-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Concessionaria</th>
                  <th className="px-4 py-3 font-medium">Stato</th>
                  <th className="px-4 py-3 font-medium">Piano</th>
                  <th className="px-4 py-3 font-medium">Titolare</th>
                  <th className="px-4 py-3 text-right font-medium">Utenti</th>
                  <th className="px-4 py-3 text-right font-medium">Auto</th>
                  <th className="px-4 py-3 text-right font-medium">Lead 30 gg</th>
                  <th className="px-4 py-3 font-medium">Ultimo accesso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibili.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/piattaforma/${o.id}`)}
                  >
                    <td className="px-4 py-3">
                      <Link to={`/piattaforma/${o.id}`} className="font-semibold hover:text-accent" onClick={(e) => e.stopPropagation()}>
                        {o.nome}
                      </Link>
                      <div className="text-sm text-muted-foreground">{[o.comune, o.piva && `P.IVA ${o.piva}`].filter(Boolean).join(" · ") || "—"}</div>
                    </td>
                    <td className="px-4 py-3"><BadgeStato org={o} /></td>
                    <td className="px-4 py-3">{PIANI[o.piano]}</td>
                    <td className="px-4 py-3">
                      <div>{o.titolare_nome ?? "—"}</div>
                      <div className="text-sm text-muted-foreground">{o.titolare_email}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.utenti_attivi}{o.max_utenti ? <span className="text-muted-foreground">/{o.max_utenti}</span> : null}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.auto_in_stock}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.lead_30gg}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{o.ultimo_accesso ? relativo(o.ultimo_accesso) : "Mai"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Telefono: schede */}
          <ul className="space-y-3 lg:hidden">
            {visibili.map((o) => (
              <li key={o.id}>
                <Link to={`/piattaforma/${o.id}`} className="block rounded-lg border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{o.nome}</p>
                      <p className="text-sm text-muted-foreground">{o.comune ?? "—"} · {PIANI[o.piano]}</p>
                    </div>
                    <BadgeStato org={o} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {o.utenti_attivi} utenti · {o.auto_in_stock} auto · {o.lead_30gg} lead in 30 gg · accesso {o.ultimo_accesso ? relativo(o.ultimo_accesso) : "mai"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
