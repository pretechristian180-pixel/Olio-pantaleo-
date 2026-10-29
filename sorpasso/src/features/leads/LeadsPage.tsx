import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, ListSkeleton } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { FONTI, PIPELINE, STATI_LEAD, opzioni, tonePunteggio, toneClasses } from "@/lib/labels";
import { addDays, dataBreve, relativo, startOfDay, startOfMonth } from "@/lib/format";
import { useVenditori } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { FonteLead, LeadView, StatoLead } from "@/types/db";
import { useCambiaStato, useLeads, type FiltriLead } from "./api";
import { ChiudiVenditaDialog, PersoDialog } from "./dialogs";
import { LeadCard, autoLead, nomeLead } from "./LeadCard";
import NuovoLeadDialog from "./NuovoLeadDialog";

type Vista = "kanban" | "tabella";
type Periodo = "tutto" | "7g" | "mese" | "3m";

const PERIODI: Record<Periodo, string> = { tutto: "Sempre", "7g": "Ultimi 7 giorni", mese: "Questo mese", "3m": "Ultimi 3 mesi" };

function inizioPeriodo(p: Periodo): string | undefined {
  if (p === "7g") return addDays(startOfDay(), -7).toISOString();
  if (p === "mese") return startOfMonth().toISOString();
  if (p === "3m") return addDays(startOfDay(), -90).toISOString();
  return undefined;
}

/** Quante card mostrare nelle colonne chiuse (vinto/perso) prima del rimando alla tabella. */
const MAX_CHIUSI = 15;

export default function LeadsPage() {
  const { isManager } = useSessione();
  const [params, setParams] = useSearchParams();
  const vista = (params.get("vista") as Vista) || "kanban";
  const [nuovo, setNuovo] = useState(false);
  const [cerca, setCerca] = useState("");
  const [fonte, setFonte] = useState<FonteLead | "">("");
  const [venditore, setVenditore] = useState("");
  const [stato, setStato] = useState<StatoLead | "">("");
  const [periodo, setPeriodo] = useState<Periodo>("3m");
  const venditori = useVenditori();

  const filtri: FiltriLead = {
    fonte,
    assegnato_a: venditore || undefined,
    stato: vista === "tabella" ? stato : "",
    da: inizioPeriodo(periodo),
    cerca: cerca.length >= 2 ? cerca : undefined,
  };
  const { data, isLoading, error, refetch } = useLeads(filtri);
  const filtriAttivi = !!(fonte || venditore || stato || cerca);

  return (
    <div>
      <PageHeader
        title="Lead"
        subtitle={data ? `${data.filter((l) => l.stato !== "vinto" && l.stato !== "perso").length} aperti` : undefined}
        action={
          <Button variant="accent" onClick={() => setNuovo(true)}>
            <Plus aria-hidden /> Nuovo lead
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented
          label="Vista"
          className="lg:w-64"
          value={vista}
          onChange={(v) => setParams(v === "kanban" ? {} : { vista: v }, { replace: true })}
          options={[
            { value: "kanban", label: "Pipeline" },
            { value: "tabella", label: "Tabella" },
          ]}
        />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca nome, telefono, auto…"
            className="pl-11"
            aria-label="Cerca lead"
          />
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <Select aria-label="Fonte" value={fonte} onChange={(e) => setFonte(e.target.value as FonteLead | "")} className="sm:w-44">
          <option value="">Tutte le fonti</option>
          {opzioni(FONTI).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {isManager && (
          <Select aria-label="Venditore" value={venditore} onChange={(e) => setVenditore(e.target.value)} className="sm:w-48">
            <option value="">Tutti i venditori</option>
            <option value="nessuno">Non assegnati</option>
            {venditori.data?.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.nome}
              </option>
            ))}
          </Select>
        )}
        {vista === "tabella" && (
          <Select aria-label="Stato" value={stato} onChange={(e) => setStato(e.target.value as StatoLead | "")} className="sm:w-44">
            <option value="">Tutti gli stati</option>
            {PIPELINE.map((s) => (
              <option key={s} value={s}>
                {STATI_LEAD[s].label}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className="sm:w-48">
          {opzioni(PERIODI).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.length ? (
        filtriAttivi || periodo !== "tutto" ? (
          <EmptyState art="ricerca" title="Nessun lead con questi filtri" text="Prova ad allargare il periodo o a togliere qualche filtro." />
        ) : (
          <EmptyState
            art="lead"
            title="Ancora nessun lead"
            text="Inserisci il primo contatto: chi chiama, chi scrive dai portali, chi entra in salone."
            action={
              <Button variant="accent" onClick={() => setNuovo(true)}>
                <Plus aria-hidden /> Aggiungi il primo lead
              </Button>
            }
          />
        )
      ) : vista === "kanban" ? (
        <Kanban leads={data} />
      ) : (
        <Tabella leads={data} />
      )}

      {nuovo && <NuovoLeadDialog open={nuovo} onOpenChange={setNuovo} />}
    </div>
  );
}

/* ---------- Kanban ---------- */

function Kanban({ leads }: { leads: LeadView[] }) {
  const { isAmministrazione } = useSessione();
  const cambia = useCambiaStato();
  const [trascinato, setTrascinato] = useState<LeadView | null>(null);
  const [perso, setPerso] = useState<string | null>(null);
  const [vinto, setVinto] = useState<LeadView | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Su telefono serve tenere premuto: lo scorrimento orizzontale resta libero.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const perStato = useMemo(() => {
    const m = Object.fromEntries(PIPELINE.map((s) => [s, [] as LeadView[]])) as Record<StatoLead, LeadView[]>;
    for (const l of leads) m[l.stato].push(l);
    // In alto i lead più urgenti: in ritardo, poi per punteggio.
    for (const s of PIPELINE) m[s].sort((a, b) => Number(b.in_ritardo) - Number(a.in_ritardo) || b.punteggio - a.punteggio);
    return m;
  }, [leads]);

  function onDragStart(e: DragStartEvent) {
    setTrascinato(leads.find((l) => l.id === e.active.id) ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    setTrascinato(null);
    const lead = leads.find((l) => l.id === e.active.id);
    const nuovo = e.over?.id as StatoLead | undefined;
    if (!lead || !nuovo || nuovo === lead.stato) return;
    if (lead.stato === "vinto") {
      toast.error("Questa vendita è già chiusa: per modificarla vai in «Pratiche».");
      return;
    }
    if (nuovo === "perso") return setPerso(lead.id);
    if (nuovo === "vinto") return setVinto(lead);
    try {
      await cambia.mutateAsync({ id: lead.id, stato: nuovo });
      toast.success(`${nomeLead(lead)} → ${STATI_LEAD[nuovo].label}`);
    } catch (err) {
      mostraErrore(err);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setTrascinato(null)}>
      <p className="mb-3 text-sm text-muted-foreground">
        {isAmministrazione ? "Vista in sola lettura." : "Trascina una card per cambiare fase (su telefono: tieni premuto e trascina)."}
      </p>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {PIPELINE.map((s) => (
          <Colonna key={s} stato={s} leads={perStato[s]} disabilitato={isAmministrazione} />
        ))}
      </div>
      <DragOverlay>{trascinato && <LeadCard lead={trascinato} className="w-72 rotate-2 shadow-raised" />}</DragOverlay>
      {perso && <PersoDialog leadId={perso} open onOpenChange={(v) => !v && setPerso(null)} />}
      {vinto && (
        <ChiudiVenditaDialog
          leadId={vinto.id}
          vehicleId={vinto.vehicle_id}
          prezzoProposto={vinto.veicolo_prezzo}
          open
          onOpenChange={(v) => !v && setVinto(null)}
        />
      )}
    </DndContext>
  );
}

function Colonna({ stato, leads, disabilitato }: { stato: StatoLead; leads: LeadView[]; disabilitato: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stato, disabled: disabilitato });
  const chiusa = stato === "vinto" || stato === "perso";
  const visibili = chiusa ? leads.slice(0, MAX_CHIUSI) : leads;
  const info = STATI_LEAD[stato];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl bg-muted/70 p-2 transition-colors sm:w-72",
        isOver && "bg-accent-soft ring-2 ring-accent/40",
      )}
    >
      <div className="flex items-center justify-between px-2 py-2">
        <span className="flex items-center gap-2 font-semibold">
          <span className={cn("size-2.5 rounded-full", toneClasses[info.tone].dot)} aria-hidden />
          {info.label}
        </span>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">{leads.length}</span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2">
        {visibili.map((l) => (
          <CardTrascinabile key={l.id} lead={l} disabilitato={disabilitato} />
        ))}
        {leads.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nessun lead</p>}
        {leads.length > visibili.length && (
          <Link to={`/lead?vista=tabella`} className="px-2 py-2 text-center text-sm font-medium text-accent">
            +{leads.length - visibili.length} altri nella tabella
          </Link>
        )}
      </div>
    </div>
  );
}

function CardTrascinabile({ lead, disabilitato }: { lead: LeadView; disabilitato: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, disabled: disabilitato });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-40")}>
      <LeadCard lead={lead} />
    </div>
  );
}

/* ---------- Tabella ---------- */

function Tabella({ leads }: { leads: LeadView[] }) {
  return (
    <>
      {/* Telefono: elenco di card */}
      <div className="space-y-2 md:hidden">
        {leads.map((l) => (
          <LeadCard key={l.id} lead={l} />
        ))}
      </div>
      {/* Desktop: tabella */}
      <div className="hidden overflow-x-auto rounded-lg border bg-card shadow-card md:block">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b bg-muted/50 text-sm text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Auto</th>
              <th className="px-4 py-3 font-medium">Fonte</th>
              <th className="px-4 py-3 font-medium">Stato</th>
              <th className="px-4 py-3 font-medium">Punti</th>
              <th className="px-4 py-3 font-medium">Venditore</th>
              <th className="px-4 py-3 font-medium">Prossima azione</th>
              <th className="px-4 py-3 font-medium">Creato</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const scaduta = l.prossima_azione_at && new Date(l.prossima_azione_at) < new Date();
              return (
                <tr key={l.id} className={cn("border-b last:border-0 hover:bg-muted/40", l.in_ritardo && "bg-destructive-soft/40")}>
                  <td className="px-4 py-3">
                    <Link to={`/lead/${l.id}`} className="font-semibold hover:text-accent">
                      {nomeLead(l)}
                    </Link>
                    {l.contatto_telefono && <div className="text-sm text-muted-foreground">{l.contatto_telefono}</div>}
                  </td>
                  <td className="max-w-48 truncate px-4 py-3">{autoLead(l) ?? "—"}</td>
                  <td className="px-4 py-3">{FONTI[l.fonte]}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATI_LEAD[l.stato].tone} size="sm">
                      {STATI_LEAD[l.stato].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={tonePunteggio(l.punteggio)} dot={false} size="sm">
                      {l.punteggio}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{l.assegnato_nome ?? "—"}</td>
                  <td className="px-4 py-3">
                    {l.in_ritardo ? (
                      <span className="font-semibold text-destructive">Da contattare subito</span>
                    ) : l.senza_prossima_azione ? (
                      <span className="flex items-center gap-1 font-medium text-warning">
                        <AlertTriangle className="size-4" aria-hidden /> Mancante
                      </span>
                    ) : l.prossima_azione_at ? (
                      <span className={cn(scaduta && "font-semibold text-destructive")}>{relativo(l.prossima_azione_at)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{dataBreve(l.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
