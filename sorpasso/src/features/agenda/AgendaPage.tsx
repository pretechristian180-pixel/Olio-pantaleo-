import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Car, ChevronLeft, ChevronRight, Plus, User } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, ListSkeleton } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useSessione } from "@/lib/auth";
import { addDays, isSameDay, ora, startOfDay, startOfWeek } from "@/lib/format";
import { STATI_APPUNTAMENTO, TIPI_APPUNTAMENTO, toneClasses } from "@/lib/labels";
import { useVenditori } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { clienteAppuntamento, useAppuntamenti, type AppuntamentoEsteso } from "./api";
import type { AppuntamentoIniziale } from "./AppuntamentoDialog";

const AppuntamentoDialog = lazy(() => import("./AppuntamentoDialog"));

type Vista = "settimana" | "venditori";

const giornoBreve = (d: Date) => d.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", "");
const titoloSettimana = (inizio: Date) => {
  const fine = addDays(inizio, 6);
  const stessoMese = inizio.getMonth() === fine.getMonth();
  const da = inizio.toLocaleDateString("it-IT", { day: "numeric", month: stessoMese ? undefined : "short" });
  const a = fine.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  return `${da} – ${a}`;
};

/** Giorno alle 10:00, o undefined per oggi (il dialog propone la prossima mezz'ora libera). */
function orarioProposto(giorno: Date): Date | undefined {
  if (isSameDay(giorno, new Date())) return undefined;
  const d = startOfDay(giorno);
  d.setHours(10);
  return d;
}

export default function AgendaPage() {
  const { isManager, userId } = useSessione();
  const venditori = useVenditori();
  const [inizioSettimana, setInizioSettimana] = useState(() => startOfWeek());
  const [giorno, setGiorno] = useState(() => startOfDay());
  const [vista, setVista] = useState<Vista>("settimana");
  const [filtro, setFiltro] = useState("");
  const [dialog, setDialog] = useState<{ appuntamento?: AppuntamentoEsteso; iniziale?: AppuntamentoIniziale } | null>(null);

  const fineSettimana = addDays(inizioSettimana, 7);
  const q = useAppuntamenti(inizioSettimana, fineSettimana, filtro || undefined);
  const lista = q.data ?? [];
  const giorni = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(inizioSettimana, i)), [inizioSettimana]);
  const delGiorno = (d: Date) => lista.filter((a) => isSameDay(new Date(a.inizio), d));
  const nomeVenditore = (id: string | null) => venditori.data?.find((p) => p.user_id === id)?.nome;

  function vaiA(settimana: Date) {
    setInizioSettimana(settimana);
    const oggi = startOfDay();
    setGiorno(oggi >= settimana && oggi < addDays(settimana, 7) ? oggi : settimana);
  }

  const nuovo = (d?: Date, assegnato_a?: string) =>
    setDialog({ iniziale: { inizio: d ? orarioProposto(d) : undefined, assegnato_a: assegnato_a ?? (filtro || undefined) } });

  const mostraVenditore = isManager && !filtro;
  const card = (a: AppuntamentoEsteso, compatta = false) => (
    <AppuntamentoCard key={a.id} a={a} compatta={compatta} venditore={mostraVenditore ? nomeVenditore(a.assegnato_a) : undefined} onClick={() => setDialog({ appuntamento: a, iniziale: { cliente: clienteAppuntamento(a) ?? undefined } })} />
  );

  const settimanaCorrente = isSameDay(inizioSettimana, startOfWeek());

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Test drive, consegne e valutazioni della settimana."
        action={
          <Button variant="accent" onClick={() => nuovo(giorno)}>
            <Plus aria-hidden /> Nuovo appuntamento
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => vaiA(addDays(inizioSettimana, -7))} aria-label="Settimana precedente">
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => vaiA(addDays(inizioSettimana, 7))} aria-label="Settimana successiva">
            <ChevronRight aria-hidden />
          </Button>
          {!settimanaCorrente && (
            <Button variant="outline" size="sm" onClick={() => vaiA(startOfWeek())}>
              Oggi
            </Button>
          )}
          <h2 className="ml-1 text-lg font-semibold first-letter:uppercase">{titoloSettimana(inizioSettimana)}</h2>
        </div>
        {isManager && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Venditore" className="sm:w-56">
              <option value="">Tutti i venditori</option>
              {venditori.data?.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.user_id === userId ? `${p.nome} (io)` : p.nome}
                </option>
              ))}
            </Select>
            <Segmented<Vista>
              label="Vista"
              className="hidden w-72 lg:flex"
              value={vista}
              onChange={setVista}
              options={[
                { value: "settimana", label: "Settimana" },
                { value: "venditori", label: "Per venditore" },
              ]}
            />
          </div>
        )}
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          {/* Telefono: un giorno alla volta, giorni scorrevoli in alto */}
          <div className="lg:hidden">
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
              {giorni.map((d) => {
                const attivo = isSameDay(d, giorno);
                const n = delGiorno(d).length;
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => setGiorno(d)}
                    aria-pressed={attivo}
                    className={cn(
                      "flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors",
                      attivo ? "border-primary bg-primary text-white" : "bg-card",
                      !attivo && isSameDay(d, new Date()) && "border-accent text-accent",
                    )}
                  >
                    <span className="text-xs font-medium uppercase">{giornoBreve(d)}</span>
                    <span className="text-xl font-bold leading-tight">{d.getDate()}</span>
                    <span className={cn("mt-1 size-1.5 rounded-full", n ? (attivo ? "bg-white" : "bg-accent") : "bg-transparent")} aria-hidden />
                    <span className="sr-only">{n} appuntamenti</span>
                  </button>
                );
              })}
            </div>
            <p className="mb-3 text-[17px] font-semibold first-letter:uppercase">
              {giorno.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {q.isLoading ? (
              <ListSkeleton rows={3} />
            ) : delGiorno(giorno).length === 0 ? (
              <EmptyState
                art="calendario"
                compact
                title="Nessun appuntamento"
                text="Giornata libera: è il momento giusto per fissare un test drive."
                action={
                  <Button variant="accent" onClick={() => nuovo(giorno)}>
                    <Plus aria-hidden /> Fissa un appuntamento
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">{delGiorno(giorno).map((a) => card(a))}</div>
            )}
          </div>

          {/* Desktop */}
          <div className="hidden lg:block">
            {q.isLoading ? (
              <ListSkeleton rows={1} className="[&>*]:h-96" />
            ) : vista === "venditori" && isManager ? (
              <VistaVenditori
                giorni={giorni}
                venditori={(venditori.data ?? []).filter((p) => !filtro || p.user_id === filtro)}
                lista={lista}
                onNuovo={nuovo}
                card={card}
              />
            ) : (
              <>
                <div className="grid grid-cols-7 gap-2">
                  {giorni.map((d) => {
                    const oggi = isSameDay(d, new Date());
                    const items = delGiorno(d);
                    return (
                      <div key={d.toISOString()} className={cn("flex min-h-80 flex-col rounded-lg border bg-card", oggi && "border-accent ring-2 ring-accent/15")}>
                        <div className={cn("border-b px-3 py-2", oggi && "bg-accent-soft")}>
                          <span className="text-sm font-medium uppercase text-muted-foreground">{giornoBreve(d)}</span>{" "}
                          <span className={cn("text-lg font-bold", oggi && "text-accent")}>{d.getDate()}</span>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-2">
                          {items.map((a) => card(a, true))}
                          <button
                            type="button"
                            onClick={() => nuovo(d)}
                            className="group flex min-h-12 flex-1 items-start justify-center rounded-md pt-2 text-sm text-muted-foreground/0 transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:text-muted-foreground"
                            aria-label={`Nuovo appuntamento ${d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric" })}`}
                          >
                            <Plus className="size-4" aria-hidden /> Aggiungi
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {lista.length === 0 && (
                  <p className="mt-4 text-center text-muted-foreground">
                    Nessun appuntamento questa settimana. Clicca su un giorno per fissarne uno.
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}

      {dialog && (
        <Suspense fallback={null}>
          <AppuntamentoDialog
            open
            onOpenChange={(o) => !o && setDialog(null)}
            appuntamento={dialog.appuntamento}
            iniziale={dialog.iniziale}
          />
        </Suspense>
      )}
    </div>
  );
}

function VistaVenditori({
  giorni,
  venditori,
  lista,
  onNuovo,
  card,
}: {
  giorni: Date[];
  venditori: { user_id: string; nome: string }[];
  lista: AppuntamentoEsteso[];
  onNuovo: (d: Date, assegnato_a: string) => void;
  card: (a: AppuntamentoEsteso, compatta?: boolean) => React.ReactNode;
}) {
  if (venditori.length === 0) {
    return <EmptyState art="persone" compact title="Nessun venditore attivo" text="Invita i venditori da Impostazioni → Utenti." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[960px] table-fixed border-collapse">
        <thead>
          <tr className="border-b">
            <th className="w-40 px-3 py-2 text-left text-sm font-medium text-muted-foreground">Venditore</th>
            {giorni.map((d) => (
              <th key={d.toISOString()} className={cn("px-2 py-2 text-left text-sm font-medium", isSameDay(d, new Date()) ? "text-accent" : "text-muted-foreground")}>
                <span className="uppercase">{giornoBreve(d)}</span> <span className="text-base font-bold">{d.getDate()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {venditori.map((p) => (
            <tr key={p.user_id} className="border-b last:border-0">
              <th scope="row" className="px-3 py-2 text-left align-top text-[15px] font-semibold">
                {p.nome}
              </th>
              {giorni.map((d) => {
                const items = lista.filter((a) => a.assegnato_a === p.user_id && isSameDay(new Date(a.inizio), d));
                return (
                  <td key={d.toISOString()} className={cn("border-l p-1.5 align-top", isSameDay(d, new Date()) && "bg-accent-soft/40")}>
                    <div className="flex flex-col gap-1.5">
                      {items.map((a) => card(a, true))}
                      <button
                        type="button"
                        onClick={() => onNuovo(d, p.user_id)}
                        className="h-9 rounded-md text-sm text-muted-foreground/0 hover:bg-muted hover:text-muted-foreground focus-visible:text-muted-foreground"
                        aria-label={`Nuovo appuntamento per ${p.nome}`}
                      >
                        + Aggiungi
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppuntamentoCard({
  a,
  compatta,
  venditore,
  onClick,
}: {
  a: AppuntamentoEsteso;
  compatta?: boolean;
  venditore?: string;
  onClick: () => void;
}) {
  const tipo = TIPI_APPUNTAMENTO[a.tipo];
  const cliente = clienteAppuntamento(a);
  const chiuso = a.stato === "annullato" || a.stato === "non_presentato";
  const auto = a.vehicles ? `${a.vehicles.marca} ${a.vehicles.modello}` : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-md border bg-background text-left shadow-card transition-colors hover:border-accent/50",
        compatta ? "py-1.5 pl-3 pr-2" : "py-3 pl-4 pr-3",
        chiuso && "opacity-60",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", toneClasses[tipo.tone].solid)} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-semibold tabular-nums", compatta ? "text-sm" : "text-[17px]", chiuso && "line-through")}>
          {ora(a.inizio)}
          {!compatta && <span className="font-normal text-muted-foreground"> – {ora(a.fine)}</span>}
        </span>
        {!compatta && (
          <Badge tone={tipo.tone} size="sm">
            {tipo.label}
          </Badge>
        )}
      </div>
      {compatta && <p className="truncate text-xs font-medium text-muted-foreground">{tipo.label}</p>}
      {cliente && (
        <p className={cn("flex items-center gap-1.5 truncate", compatta ? "text-sm" : "mt-1.5 text-[15px] font-medium")}>
          {!compatta && <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          <span className="truncate">{cliente}</span>
        </p>
      )}
      {auto && (
        <p className={cn("flex items-center gap-1.5 truncate text-muted-foreground", compatta ? "text-xs" : "text-[15px]")}>
          {!compatta && <Car className="size-4 shrink-0" aria-hidden />}
          <span className="truncate">{auto}</span>
        </p>
      )}
      {!compatta && (venditore || a.stato !== "programmato" || a.lead_id) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {venditore && <span>con {venditore}</span>}
          {a.stato !== "programmato" && <span>{STATI_APPUNTAMENTO[a.stato]}</span>}
          {a.lead_id && (
            <Link to={`/lead/${a.lead_id}`} onClick={(e) => e.stopPropagation()} className="ml-auto font-medium text-accent">
              Apri lead
            </Link>
          )}
        </div>
      )}
      {compatta && venditore && <p className="truncate text-xs text-muted-foreground">{venditore}</p>}
    </div>
  );
}
