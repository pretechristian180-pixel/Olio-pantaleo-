import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useQuery } from "@/hooks/useQuery";
import { stages } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { formatShortPrice, fullName } from "@/lib/format";
import { createDeal, listDeals, moveDeal, pickerOptions, type DealWithRefs } from "@/services/api";
import type { DealStage } from "@/types/domain";
import { DealCard } from "./DealCard";

export function DealsPage() {
  const { data, loading } = useQuery(listDeals);
  const isDesktop = useIsDesktop();
  const [newOpen, setNewOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = useMemo(() => {
    const map = Object.fromEntries(stages.map((s) => [s.id, [] as DealWithRefs[]])) as Record<DealStage, DealWithRefs[]>;
    data?.forEach((d) => map[d.stage].push(d));
    return map;
  }, [data]);

  async function move(deal: DealWithRefs, to: DealStage) {
    if (deal.stage === to) return;
    const from = deal.stage;
    await moveDeal(deal.id, to);
    const label = stages.find((s) => s.id === to)!.label;
    const who = deal.contact ? ` di ${fullName(deal.contact)}` : "";
    const msg = to === "rogito" ? `Complimenti! La trattativa${who} è arrivata al rogito` : `Trattativa${who} spostata in “${label}”`;
    toast.success(msg, { action: { label: "Annulla", onClick: () => moveDeal(deal.id, from) } });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const deal = data?.find((d) => d.id === e.active.id);
    if (deal && e.over) move(deal, e.over.id as DealStage);
  }

  const active = data?.find((d) => d.id === activeId);

  const addButton = (
    <Button size="lg" onClick={() => setNewOpen(true)}>
      <Plus aria-hidden />
      Nuova trattativa
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Trattative"
        subtitle={isDesktop ? "Trascina una card per spostarla nella fase successiva" : "Scorri di lato per vedere tutte le fasi"}
        action={addButton}
      />

      {loading || !data ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-80 w-[85%] shrink-0 lg:w-auto lg:flex-1" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          art="trattative"
          title="Nessuna trattativa ancora"
          text="Quando un cliente si interessa a un immobile, aggiungi qui la trattativa e seguila fino al rogito."
          action={addButton}
        />
      ) : isDesktop ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="grid grid-cols-5 gap-3">
            {stages.map((s) => (
              <Column key={s.id} id={s.id} label={s.label} deals={byStage[s.id]}>
                {byStage[s.id].map((d) => (
                  <DraggableDeal key={d.id} deal={d} />
                ))}
              </Column>
            ))}
          </div>
          <DragOverlay dropAnimation={null}>{active ? <DealCard deal={active} overlay /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <MobileBoard byStage={byStage} onMove={move} />
      )}

      <NewDealDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

function ColumnHeader({ label, deals }: { label: string; deals: DealWithRefs[] }) {
  const total = deals.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="mb-3 px-1">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{label}</h2>
        <span className="flex size-7 items-center justify-center rounded-full bg-background text-sm font-semibold tabular-nums">
          {deals.length}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{deals.length ? formatShortPrice(total) : "Vuota"}</p>
    </div>
  );
}

function Column({ id, label, deals, children }: { id: DealStage; label: string; deals: DealWithRefs[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-[60vh] flex-col rounded-xl bg-muted p-3 transition-colors",
        isOver && "bg-primary-soft ring-2 ring-primary/40",
      )}
    >
      <ColumnHeader label={label} deals={deals} />
      <div className="space-y-3">{children}</div>
      {deals.length === 0 && (
        <p className="mt-2 rounded-lg border-2 border-dashed border-border px-3 py-6 text-center text-[15px] text-muted-foreground">
          Trascina qui
        </p>
      )}
    </section>
  );
}

function DraggableDeal({ deal }: { deal: DealWithRefs }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return <DealCard ref={setNodeRef} deal={deal} dragging={isDragging} {...attributes} {...listeners} />;
}

/** Su telefono: colonne scorrevoli orizzontalmente, con le fasi in alto per saltare. */
function MobileBoard({
  byStage,
  onMove,
}: {
  byStage: Record<DealStage, DealWithRefs[]>;
  onMove: (d: DealWithRefs, to: DealStage) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const col = el.firstElementChild as HTMLElement | null;
      if (!col) return;
      setCurrent(Math.round(el.scrollLeft / (col.offsetWidth + 12)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const tab = tabs.current?.children[current] as HTMLElement | undefined;
    tab?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [current]);

  function goTo(i: number) {
    const el = scroller.current;
    const col = el?.children[i] as HTMLElement | undefined;
    if (el && col) el.scrollTo({ left: col.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }

  return (
    <div className="-mx-4">
      <div ref={tabs} role="tablist" aria-label="Fasi" className="mb-4 flex gap-2 overflow-x-auto px-4 scrollbar-none">
        {stages.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === current}
            onClick={() => goTo(i)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-medium",
              i === current ? "border-primary bg-primary text-white" : "bg-background text-foreground/80",
            )}
          >
            {s.label}
            <span className={cn("text-sm tabular-nums", i === current ? "text-white/80" : "text-muted-foreground")}>
              {byStage[s.id].length}
            </span>
          </button>
        ))}
      </div>
      <div ref={scroller} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 scrollbar-none">
        {stages.map((s, i) => {
          const next = stages[i + 1];
          return (
            <section key={s.id} className="w-[86%] shrink-0 snap-start rounded-xl bg-muted p-3">
              <ColumnHeader label={s.label} deals={byStage[s.id]} />
              <div className="space-y-3">
                {byStage[s.id].map((d) => (
                  <DealCard key={d.id} deal={d} nextLabel={next?.label} onNext={next ? () => onMove(d, next.id) : undefined} />
                ))}
                {byStage[s.id].length === 0 && (
                  <p className="rounded-lg border-2 border-dashed border-border px-3 py-8 text-center text-muted-foreground">
                    Nessuna trattativa in questa fase
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function NewDealDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Nuova trattativa" description="Scegli il cliente e l'immobile che gli interessa">
        {open && <NewDealForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function NewDealForm({ onDone }: { onDone: () => void }) {
  const { contacts, properties } = useMemo(pickerOptions, []);
  const buyers = contacts.filter((c) => c.role === "acquirente");
  const [contactId, setContactId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [error, setError] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId || !propertyId) {
      setError(true);
      return;
    }
    await createDeal({ contactId, propertyId });
    const c = buyers.find((x) => x.id === contactId);
    toast.success("Trattativa aggiunta", { description: c ? `${fullName(c)} è in “Nuovo contatto”` : undefined });
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Field label="Cliente" htmlFor="nd-c">
        <Select id="nd-c" value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">Scegli il cliente</option>
          {buyers.map((c) => (
            <option key={c.id} value={c.id}>
              {fullName(c)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Immobile" htmlFor="nd-p">
        <Select id="nd-p" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">Scegli l'immobile</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}, {p.city}
            </option>
          ))}
        </Select>
      </Field>
      {error && <p className="text-sm font-medium text-destructive">Scegli sia il cliente sia l'immobile</p>}
      <Button type="submit" size="lg" className="w-full">
        Aggiungi trattativa
      </Button>
    </form>
  );
}
