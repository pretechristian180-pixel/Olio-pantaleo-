import { useState } from "react";
import { Link } from "react-router-dom";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PropertyPhoto } from "@/components/shared/PropertyPhoto";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { addDays, formatTime, isSameDay, startOfDay, startOfWeek } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isApprover, listCalendar, schedule } from "@/services/studio";
import type { CalendarPost, Platform, PostStatus } from "@/types/studio";
import { platformLabel, postStatus } from "./labels";

type Mode = "settimana" | "mese";

/** Un video in un orario: raggruppa i post delle varie piattaforme */
interface Slot {
  key: string;
  videoId: string;
  publishAt: string;
  platforms: Platform[];
  status: PostStatus;
  address: string;
  thumbUrl?: string;
  movable: boolean;
}

function toSlots(posts: CalendarPost[]): Slot[] {
  const map = new Map<string, Slot>();
  for (const p of posts) {
    const key = `${p.videoId}|${p.publishAt}`;
    const s = map.get(key);
    if (s) {
      s.platforms.push(p.platform);
      if (p.status === "fallito" || (p.status === "pubblicato" && s.status === "in_coda")) s.status = p.status;
      s.movable = s.movable && p.status === "in_coda";
    } else {
      map.set(key, {
        key,
        videoId: p.videoId,
        publishAt: p.publishAt,
        platforms: [p.platform],
        status: p.status,
        address: p.video.property.address,
        thumbUrl: p.video.thumbUrl,
        movable: p.status === "in_coda" && p.video.status === "programmato",
      });
    }
  }
  return [...map.values()];
}

// Dopo un trascinamento il rilascio non deve aprire il video
let lastDrag = 0;
const afterDrag = (e: React.MouseEvent) => {
  if (Date.now() - lastDrag < 400) e.preventDefault();
};

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function CalendarView() {
  const [mode, setMode] = useState<Mode>("settimana");
  const [anchor, setAnchor] = useState(() => new Date());

  const from = mode === "settimana" ? startOfWeek(anchor) : startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const days = mode === "settimana" ? 7 : 42;
  const to = addDays(from, days);
  const { data, loading, error, reload } = useQuery(
    async () => ({ posts: await listCalendar(from, to), approver: await isApprover() }),
    [from.getTime(), days],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const slots = toSlots(data?.posts ?? []).map((s) => ({ ...s, movable: s.movable && !!data?.approver }));
  const byDay = new Map<string, Slot[]>();
  for (const s of slots) {
    const k = dayKey(new Date(s.publishAt));
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }

  async function onDragEnd(e: DragEndEvent) {
    lastDrag = Date.now();
    if (!e.over) return;
    const slot = slots.find((s) => s.key === String(e.active.id).split("#")[0]);
    if (!slot) return;
    const old = new Date(slot.publishAt);
    const [y, m, d] = String(e.over.id).split("-").map(Number);
    const next = new Date(y, m - 1, d, old.getHours(), old.getMinutes());
    if (isSameDay(next, old)) return;
    if (next.getTime() < Date.now()) return toast.error("Non puoi spostare un video nel passato");
    try {
      await schedule(slot.videoId, next.toISOString(), []);
      toast.success("Data cambiata", { description: `${slot.address}: ${next.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}` });
    } catch (err) {
      toast.error("Data non cambiata", { description: friendlyError(err) });
    }
  }

  const title =
    mode === "settimana"
      ? `${from.toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – ${addDays(from, 6).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`
      : anchor.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const move = (n: number) =>
    setAnchor((a) => (mode === "settimana" ? addDays(a, 7 * n) : new Date(a.getFullYear(), a.getMonth() + n, 1)));

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          label="Vista del calendario"
          value={mode}
          onChange={setMode}
          className="sm:w-72"
          options={[
            { value: "settimana", label: "Settimana" },
            { value: "mese", label: "Mese" },
          ]}
        />
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={() => move(-1)}>
            <ChevronLeft aria-hidden />
            Prima
          </Button>
          <p className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold first-letter:uppercase">{title}</p>
          <Button variant="outline" size="sm" onClick={() => move(1)}>
            Dopo
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
      {data?.approver && slots.some((s) => s.movable) && (
        <p className="mb-4 text-[15px] text-muted-foreground">Per cambiare giorno, tieni premuto un video e trascinalo. L'orario resta lo stesso.</p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <Skeleton className="h-96" />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {mode === "settimana" ? (
            <div className="grid gap-3 lg:grid-cols-7 lg:gap-2">
              {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => (
                <DayColumn key={dayKey(d)} day={d} slots={byDay.get(dayKey(d)) ?? []} />
              ))}
            </div>
          ) : (
            <MonthGrid from={from} month={anchor.getMonth()} byDay={byDay} />
          )}
          {slots.length === 0 && (
            <EmptyState
              art="calendario"
              title="Nessun video programmato"
              text="Quando approvi un video, scegli la data e lo trovi qui."
              className="mt-4 rounded-lg border"
            />
          )}
        </DndContext>
      )}
    </div>
  );
}

function DayColumn({ day, slots }: { day: Date; slots: Slot[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(day) });
  const today = isSameDay(day, new Date());
  const past = day < startOfDay(new Date());
  if (slots.length === 0 && !isOver)
    return (
      <div ref={setNodeRef} className={cn("rounded-lg border border-dashed px-3 py-2 lg:min-h-48", past && "opacity-60")}>
        <DayLabel day={day} today={today} />
      </div>
    );
  return (
    <div ref={setNodeRef} className={cn("space-y-2 rounded-lg border bg-card/60 p-2 lg:min-h-48", isOver && "border-primary bg-primary-soft/60")}>
      <DayLabel day={day} today={today} />
      {slots.map((s) => (
        <SlotCard key={s.key} slot={s} />
      ))}
    </div>
  );
}

function DayLabel({ day, today }: { day: Date; today: boolean }) {
  return (
    <p className={cn("px-1 text-[15px] font-semibold first-letter:uppercase", today ? "text-primary-strong" : "text-muted-foreground")}>
      {day.toLocaleDateString("it-IT", { weekday: "long", day: "numeric" })}
      {today && " · oggi"}
    </p>
  );
}

function SlotCard({ slot, compact }: { slot: Slot; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: compact ? `${slot.key}#c` : slot.key, disabled: !slot.movable });
  const st = postStatus[slot.status];
  return (
    <div
      ref={setNodeRef}
      {...(slot.movable ? { ...attributes, ...listeners } : {})}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn("relative", slot.movable && "touch-none", isDragging && "z-20 opacity-90 shadow-raised")}
    >
      <Link
        to={`/studio/video/${slot.videoId}`}
        draggable={false}
        onClick={afterDrag}
        className={cn("flex gap-2 rounded-md border bg-card p-2 hover:border-primary/40", compact && "p-1")}
      >
        <span className={cn("aspect-[9/16] shrink-0 overflow-hidden rounded bg-muted", compact ? "w-6" : "w-10")}>
          <PropertyPhoto photo={{ id: slot.key, url: slot.thumbUrl, scene: "soggiorno" }} kind="appartamento" tint={20} alt="" />
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold tabular-nums">{formatTime(slot.publishAt)}</span>
            <span className="block truncate text-sm">{slot.address}</span>
            <span className="block truncate text-[13px] text-muted-foreground">{slot.platforms.map((p) => platformLabel[p]).join(" · ")}</span>
            {slot.status !== "in_coda" && (
              <Badge tone={st.tone} className="mt-1 px-2 py-0.5 text-[12px]">
                {st.label}
              </Badge>
            )}
          </span>
        )}
      </Link>
    </div>
  );
}

function MonthGrid({ from, month, byDay }: { from: Date; month: number; byDay: Map<string, Slot[]> }) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-sm font-medium text-muted-foreground">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map((d) => (
          <MonthCell key={dayKey(d)} day={d} inMonth={d.getMonth() === month} slots={byDay.get(dayKey(d)) ?? []} />
        ))}
      </div>
    </div>
  );
}

function MonthCell({ day, inMonth, slots }: { day: Date; inMonth: boolean; slots: Slot[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(day) });
  const today = isSameDay(day, new Date());
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-20 rounded-md border bg-card p-1 sm:min-h-28",
        !inMonth && "bg-muted/50 opacity-60",
        isOver && "border-primary bg-primary-soft/60",
      )}
    >
      <p className={cn("px-0.5 text-sm font-semibold tabular-nums", today ? "text-primary-strong" : "text-muted-foreground")}>{day.getDate()}</p>
      <div className="mt-1 flex flex-wrap gap-1 sm:block sm:space-y-1">
        {slots.map((s) => (
          <div key={s.key}>
            <div className="sm:hidden">
              <SlotCard slot={s} compact />
            </div>
            <div className="hidden sm:block">
              <MiniSlot slot={s} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniSlot({ slot }: { slot: Slot }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `${slot.key}#m`, disabled: !slot.movable });
  return (
    <div
      ref={setNodeRef}
      {...(slot.movable ? { ...attributes, ...listeners } : {})}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(slot.movable && "touch-none", isDragging && "relative z-20 shadow-raised")}
    >
      <Link
        to={`/studio/video/${slot.videoId}`}
        draggable={false}
        onClick={afterDrag}
        className={cn(
          "block truncate rounded px-1.5 py-1 text-[13px] font-medium",
          slot.status === "fallito" ? "bg-destructive-soft text-destructive" : slot.status === "pubblicato" ? "bg-success-soft text-success" : "bg-primary-soft text-primary-strong",
        )}
      >
        {formatTime(slot.publishAt)} {slot.address}
      </Link>
    </div>
  );
}
