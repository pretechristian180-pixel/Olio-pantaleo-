import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, ListSkeleton } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { useSessione } from "@/lib/auth";
import { dataBreve, euro, nomeCompleto, startOfDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type PraticaEstesa, prossimaVoce, usePratiche } from "./api";

type Filtro = "aperte" | "completate" | "tutte";

const completa = (d: PraticaEstesa) => d.avanzamento >= 100;

/** Ordine: consegna più vicina prima; senza data in fondo; poi vendita più recente. */
function ordina(a: PraticaEstesa, b: PraticaEstesa) {
  if (a.data_consegna && b.data_consegna) return a.data_consegna.localeCompare(b.data_consegna);
  if (a.data_consegna) return -1;
  if (b.data_consegna) return 1;
  return b.data_vendita.localeCompare(a.data_vendita);
}

export default function PratichePage() {
  const { isVenditore, isAmministrazione } = useSessione();
  const pratiche = usePratiche();
  const [filtro, setFiltro] = useState<Filtro>("aperte");
  const [cerca, setCerca] = useState("");

  const conteggi = useMemo(() => {
    const tutte = pratiche.data ?? [];
    return { aperte: tutte.filter((d) => !completa(d)).length, completate: tutte.filter(completa).length, tutte: tutte.length };
  }, [pratiche.data]);

  const elenco = useMemo(() => {
    const t = cerca.trim().toLowerCase();
    return (pratiche.data ?? [])
      .filter((d) => (filtro === "aperte" ? !completa(d) : filtro === "completate" ? completa(d) : true))
      .filter((d) => {
        if (!t) return true;
        const testo = [
          d.contacts && nomeCompleto(d.contacts),
          d.vehicles?.marca,
          d.vehicles?.modello,
          d.vehicles?.targa,
          d.profiles?.nome,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return testo.includes(t);
      })
      .sort(filtro === "completate" ? (a, b) => b.data_vendita.localeCompare(a.data_vendita) : ordina);
  }, [pratiche.data, filtro, cerca]);

  return (
    <>
      <PageHeader
        title="Pratiche"
        subtitle={isVenditore ? "Le tue vendite chiuse e lo stato dei documenti" : "Vendite chiuse: documenti, finanziamento, passaggio e consegna"}
      />

      {pratiche.isLoading ? (
        <ListSkeleton rows={5} />
      ) : pratiche.isError ? (
        <ErrorState error={pratiche.error} onRetry={() => void pratiche.refetch()} />
      ) : !pratiche.data?.length ? (
        <EmptyState
          art="pratiche"
          title="Ancora nessuna pratica"
          text="Le vendite chiuse dai lead compaiono qui, con la checklist per arrivare alla consegna."
          action={
            !isAmministrazione && (
              <Button asChild variant="accent">
                <Link to="/lead">Vai ai lead</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Segmented
              label="Filtra pratiche"
              value={filtro}
              onChange={setFiltro}
              className="sm:w-[420px]"
              options={[
                { value: "aperte", label: "Da completare", count: conteggi.aperte },
                { value: "completate", label: "Completate", count: conteggi.completate },
                { value: "tutte", label: "Tutte", count: conteggi.tutte },
              ]}
            />
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={cerca}
                onChange={(e) => setCerca(e.target.value)}
                placeholder="Cerca cliente, auto o targa"
                className="pl-11"
                aria-label="Cerca pratiche"
              />
            </div>
          </div>

          {elenco.length === 0 ? (
            <EmptyState
              art={filtro === "aperte" ? "fatto" : "ricerca"}
              title={filtro === "aperte" && !cerca ? "Tutte le pratiche sono complete" : "Nessuna pratica trovata"}
              text={filtro === "aperte" && !cerca ? "Ottimo lavoro: nessuna consegna in sospeso." : "Prova a cambiare ricerca o filtro."}
              action={
                <Button variant="outline" onClick={() => (setFiltro("tutte"), setCerca(""))}>
                  Mostra tutte
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {elenco.map((d) => (
                <li key={d.id}>
                  <CardPratica d={d} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function CardPratica({ d }: { d: PraticaEstesa }) {
  const prossima = prossimaVoce(d);
  const oggi = startOfDay();
  const consegna = d.data_consegna ? new Date(`${d.data_consegna}T00:00:00`) : null;
  const consegnaVicina = consegna && !completa(d) && consegna.getTime() - oggi.getTime() <= 3 * 86_400_000;
  const consegnaPassata = consegna && !completa(d) && consegna < oggi;

  return (
    <Link to={`/pratiche/${d.id}`} className="block rounded-lg border bg-card p-4 shadow-card transition-colors hover:border-accent/50">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{d.contacts ? nomeCompleto(d.contacts) : "Cliente"}</p>
          <p className="truncate text-[15px] text-muted-foreground">
            {d.vehicles ? `${d.vehicles.marca} ${d.vehicles.modello}` : "Auto"}
            {d.vehicles?.targa && ` · ${d.vehicles.targa}`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{euro(d.prezzo_finale)}</p>
          <p className="text-sm text-muted-foreground">{dataBreve(d.data_vendita)}</p>
        </div>
        <ChevronRight className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress value={d.avanzamento} className="flex-1" tone={completa(d) ? "bg-success" : "bg-accent"} />
        <span className="w-11 text-right text-sm font-semibold tabular-nums">{d.avanzamento}%</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {completa(d) ? (
          <Badge tone="green" size="sm">
            Pratica completa
          </Badge>
        ) : (
          prossima && (
            <Badge tone="yellow" size="sm">
              Prossimo: {prossima.label}
            </Badge>
          )
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1",
            consegnaPassata ? "font-semibold text-destructive" : consegnaVicina ? "font-semibold text-warning" : "text-muted-foreground",
          )}
        >
          <CalendarCheck className="size-4" aria-hidden />
          {consegna ? `Consegna ${dataBreve(consegna)}` : "Consegna da fissare"}
        </span>
        {d.profiles?.nome && <span className="text-muted-foreground">· {d.profiles.nome}</span>}
      </div>
    </Link>
  );
}
