import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PipelineTabs } from "@/features/deals/PipelineTabs";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { listAcquisitions, quickAddAcquisition } from "@/services/acquisitions";
import type { AcqPhase, Acquisition, LossReason } from "@/types/acquisitions";
import { AcquisitionCard } from "./AcquisitionCard";
import { acqPhases, lossLabel } from "./labels";
import { AcquisitionMoverProvider, useMoveAcquisition } from "./PhaseDialogs";

type ActivePhase = (typeof acqPhases)[number]["id"];

export function AcquisitionsPage() {
  return (
    <AcquisitionMoverProvider>
      <Board />
    </AcquisitionMoverProvider>
  );
}

function Board() {
  const { data, loading, error, reload } = useQuery(listAcquisitions);
  const isDesktop = useIsDesktop();
  const move = useMoveAcquisition();
  const [params, setParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(params.get("nuova") === "1");
  // Aperto dal pulsante "+": il parametro serve una volta sola
  useEffect(() => {
    if (params.get("nuova")) {
      setAddOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showLost, setShowLost] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byPhase = useMemo(() => {
    const map = Object.fromEntries(acqPhases.map((p) => [p.id, [] as Acquisition[]])) as Record<ActivePhase, Acquisition[]>;
    data?.filter((a) => a.phase !== "persa").forEach((a) => map[a.phase as ActivePhase].push(a));
    return map;
  }, [data]);
  const lost = data?.filter((a) => a.phase === "persa") ?? [];

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const a = data?.find((x) => x.id === e.active.id);
    if (a && e.over) move(a, e.over.id as AcqPhase);
  }

  const addButton = (
    <Button size="lg" onClick={() => setAddOpen(true)}>
      <Plus aria-hidden />
      Nuova segnalazione
    </Button>
  );
  const active = data?.find((a) => a.id === activeId);

  return (
    <div>
      <PipelineTabs />
      <PageHeader
        title="Acquisizioni"
        subtitle={isDesktop ? "Dal primo contatto con il proprietario all'incarico firmato" : "Scorri di lato per vedere tutte le fasi"}
        action={addButton}
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-80 w-[85%] shrink-0 lg:w-auto lg:flex-1" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          art="casa"
          title="Nessuna acquisizione ancora"
          text="Un vicino che vende, un cartello, una telefonata: segna qui ogni possibile incarico e seguilo fino alla firma."
          action={addButton}
        />
      ) : (
        <>
          {isDesktop ? (
            <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
              <div className="grid grid-cols-6 gap-2">
                {acqPhases.map((p) => (
                  <Column key={p.id} id={p.id} label={p.short} items={byPhase[p.id]}>
                    {byPhase[p.id].map((a) => (
                      <DraggableCard key={a.id} acquisition={a} />
                    ))}
                  </Column>
                ))}
              </div>
              <DragOverlay dropAnimation={null}>{active ? <AcquisitionCard acquisition={active} overlay /> : null}</DragOverlay>
            </DndContext>
          ) : (
            <MobileBoard byPhase={byPhase} onMove={move} />
          )}

          {lost.length > 0 && (
            <section className="mt-6">
              <Button variant="ghost" onClick={() => setShowLost((s) => !s)} aria-expanded={showLost}>
                <ChevronDown className={cn("transition-transform", showLost && "rotate-180")} aria-hidden />
                {showLost ? "Nascondi le perse" : `Vedi le perse (${lost.length})`}
              </Button>
              {showLost && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {lost.map((a) => (
                    <AcquisitionCard key={a.id} acquisition={a} className="opacity-80" />
                  ))}
                </div>
              )}
            </section>
          )}

          <Stats items={data} />
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent title="Nuova segnalazione" description="Bastano questi tre dati: il resto lo completi dopo.">
          {addOpen && <QuickAddForm onDone={() => setAddOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ColumnHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 px-1">
      <h2 className="font-semibold leading-tight">{label}</h2>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-sm font-semibold tabular-nums">{count}</span>
    </div>
  );
}

function Column({ id, label, items, children }: { id: ActivePhase; label: string; items: Acquisition[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={cn("flex min-h-[55vh] flex-col rounded-xl bg-muted p-2.5 transition-colors", isOver && "bg-primary-soft ring-2 ring-primary/40")}>
      <ColumnHeader label={label} count={items.length} />
      <div className="space-y-3">{children}</div>
      {items.length === 0 && (
        <p className="mt-1 rounded-lg border-2 border-dashed border-border px-2 py-6 text-center text-[15px] text-muted-foreground">Trascina qui</p>
      )}
    </section>
  );
}

function DraggableCard({ acquisition }: { acquisition: Acquisition }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: acquisition.id, disabled: !acquisition.canEdit });
  return <AcquisitionCard ref={setNodeRef} acquisition={acquisition} dragging={isDragging} className="p-3" {...attributes} {...listeners} />;
}

function MobileBoard({ byPhase, onMove }: { byPhase: Record<ActivePhase, Acquisition[]>; onMove: (a: Acquisition, to: AcqPhase) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const col = el.firstElementChild as HTMLElement | null;
      if (col) setCurrent(Math.round(el.scrollLeft / (col.offsetWidth + 12)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    (tabs.current?.children[current] as HTMLElement | undefined)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [current]);

  function goTo(i: number) {
    const el = scroller.current;
    const col = el?.children[i] as HTMLElement | undefined;
    if (el && col) el.scrollTo({ left: col.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }

  return (
    <div className="-mx-4">
      <div ref={tabs} role="tablist" aria-label="Fasi" className="mb-4 flex gap-2 overflow-x-auto px-4 scrollbar-none">
        {acqPhases.map((p, i) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={i === current}
            onClick={() => goTo(i)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-medium",
              i === current ? "border-primary bg-primary text-white" : "bg-background text-foreground/80",
            )}
          >
            {p.short}
            <span className={cn("text-sm tabular-nums", i === current ? "text-white/80" : "text-muted-foreground")}>{byPhase[p.id].length}</span>
          </button>
        ))}
      </div>
      <div ref={scroller} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 scrollbar-none">
        {acqPhases.map((p, i) => {
          const next = acqPhases[i + 1];
          return (
            <section key={p.id} className="w-[86%] shrink-0 snap-start rounded-xl bg-muted p-3">
              <ColumnHeader label={p.label} count={byPhase[p.id].length} />
              <div className="space-y-3">
                {byPhase[p.id].map((a) => (
                  <AcquisitionCard key={a.id} acquisition={a} nextLabel={next?.short} onNext={next ? () => onMove(a, next.id) : undefined} />
                ))}
                {byPhase[p.id].length === 0 && (
                  <p className="rounded-lg border-2 border-dashed border-border px-3 py-8 text-center text-muted-foreground">Nessuna acquisizione in questa fase</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function QuickAddForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ address: "", owner: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.address.trim()) return toast.error("Scrivi l'indirizzo");
    setBusy(true);
    try {
      const id = await quickAddAcquisition({ address: f.address, ownerName: f.owner, phone: f.phone });
      toast.success("Segnalazione aggiunta", {
        description: f.address.trim(),
        action: { label: "Completa", onClick: () => navigate(`/trattative/acquisizioni/${id}`) },
      });
      onDone();
    } catch (err) {
      toast.error("Non salvata", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <Field label="Indirizzo dell'immobile" htmlFor="qa-addr">
        <Input id="qa-addr" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Es. Via Calefati 45" autoFocus />
      </Field>
      <Field label="Nome del proprietario" htmlFor="qa-owner" hint="Se non lo sai ancora, lascia vuoto">
        <Input id="qa-owner" value={f.owner} onChange={(e) => set("owner", e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Telefono" htmlFor="qa-phone">
        <Input id="qa-phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        <Plus aria-hidden />
        {busy ? "Salvataggio…" : "Aggiungi"}
      </Button>
    </form>
  );
}

/** Statistiche semplici: segnalazioni e incarichi del mese, conversione, motivi di perdita */
function Stats({ items }: { items: Acquisition[] }) {
  const now = new Date();
  const thisMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };
  const reports = items.filter((a) => thisMonth(a.createdAt)).length;
  const signedMonth = items.filter((a) => a.phase === "incarico_firmato" && thisMonth(a.phaseSince)).length;
  const signed = items.filter((a) => a.phase === "incarico_firmato").length;
  const lost = items.filter((a) => a.phase === "persa");
  const closed = signed + lost.length;
  const rate = closed ? Math.round((signed / closed) * 100) : null;
  const reasons = Object.entries(
    lost.reduce<Record<string, number>>((acc, a) => {
      if (a.lossReason) acc[a.lossReason] = (acc[a.lossReason] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const month = now.toLocaleDateString("it-IT", { month: "long" });

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-semibold">Come sta andando</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero value={String(reports)} label={`segnalazioni a ${month}`} />
        <Numero value={String(signedMonth)} label={`incarichi firmati a ${month}`} />
        <Numero value={rate == null ? "–" : `${rate}%`} label={closed ? `diventano incarico (su ${closed} chiuse)` : "diventano incarico"} />
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <p className="text-[15px] text-muted-foreground">Perché le perdiamo</p>
          {reasons.length === 0 ? (
            <p className="mt-2 text-[15px]">Nessuna persa finora</p>
          ) : (
            <ul className="mt-2 space-y-1 text-[15px]">
              {reasons.slice(0, 3).map(([r, n]) => (
                <li key={r} className="flex justify-between gap-2">
                  <span className="truncate">{lossLabel[r as LossReason]}</span>
                  <strong className="tabular-nums">{n}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Numero({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <p className="text-3xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-2 text-[15px] text-muted-foreground">{label}</p>
    </div>
  );
}
