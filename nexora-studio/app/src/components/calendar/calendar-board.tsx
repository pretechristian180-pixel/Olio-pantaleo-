"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { SocialPlatform } from "@nexora/shared";
import {
  CalendarClock,
  CheckCircle2,
  GripVertical,
  Loader2,
  MoveRight,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moveVideoAction } from "@/lib/actions/calendar";
import { cn } from "@/lib/utils";

export interface BoardItem {
  videoId: string;
  title: string;
  date: string;
  time: string;
  status: "scheduled" | "publishing" | "published" | "failed";
  platforms: SocialPlatform[];
  thumbnailUrl: string | null;
}

const PLATFORM_SHORT: Record<SocialPlatform, string> = {
  instagram: "IG",
  facebook: "FB",
  tiktok: "TT",
  youtube: "YT",
  linkedin: "IN",
};
const PLATFORM_NAME: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

const STATUS_STYLE = {
  scheduled: "border-nx-blue-500/40 bg-accent",
  publishing: "border-warning/40 bg-warning-soft",
  published: "border-success/40 bg-success-soft",
  failed: "border-destructive/40 bg-destructive/10",
} as const;

function StatusIcon({ status }: { status: BoardItem["status"] }) {
  if (status === "published")
    return <CheckCircle2 className="size-3.5 text-success" aria-label="Pubblicato" />;
  if (status === "publishing")
    return <Loader2 className="size-3.5 animate-spin text-warning" aria-label="In pubblicazione" />;
  if (status === "failed")
    return <TriangleAlert className="size-3.5 text-destructive" aria-label="Non pubblicato" />;
  return <CalendarClock className="size-3.5 text-primary-text" aria-label="Programmato" />;
}

function PostCard({
  item,
  compact,
  onMove,
}: {
  item: BoardItem;
  compact?: boolean;
  onMove: (videoId: string, date: string, time: string) => void;
}) {
  const movable = item.status === "scheduled";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.videoId,
    data: item,
    disabled: !movable,
  });
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(item.date);
  const [time, setTime] = useState(item.time);
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-lg border text-left text-xs shadow-xs transition-shadow",
        STATUS_STYLE[item.status],
        isDragging && "z-50 shadow-glow",
        compact ? "px-1.5 py-1" : "p-2",
      )}
    >
      <div className="flex items-start gap-1.5">
        {movable && (
          <button
            type="button"
            {...listeners}
            {...attributes}
            aria-label={`Trascina "${item.title}" in un altro giorno`}
            className="mt-0.5 -ml-0.5 cursor-grab touch-none rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        )}
        <Link href={`/video/${item.videoId}`} className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold tabular-nums">
            <StatusIcon status={item.status} /> {item.time}
          </span>
          {!compact && (
            <span className="mt-0.5 line-clamp-2 font-medium text-foreground">{item.title}</span>
          )}
        </Link>
      </div>
      {!compact && (
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span
            className="flex gap-1"
            aria-label={`Su ${item.platforms.map((p) => PLATFORM_NAME[p]).join(", ")}`}
          >
            {item.platforms.map((p) => (
              <span
                key={p}
                className="rounded bg-background/70 px-1 text-[0.625rem] font-semibold"
                aria-hidden
              >
                {PLATFORM_SHORT[p]}
              </span>
            ))}
          </span>
          {movable && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="rounded px-1 text-[0.6875rem] font-medium text-primary-text hover:underline"
              aria-expanded={editing}
            >
              Sposta
            </button>
          )}
        </div>
      )}
      {editing && (
        <form
          className="mt-2 grid gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(false);
            onMove(item.videoId, date, time);
          }}
        >
          <label className="sr-only" htmlFor={`d-${item.videoId}`}>
            Nuova data
          </label>
          <Input
            id={`d-${item.videoId}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 text-sm"
          />
          <label className="sr-only" htmlFor={`t-${item.videoId}`}>
            Nuovo orario
          </label>
          <Input
            id={`t-${item.videoId}`}
            type="time"
            step={900}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-9 text-sm"
          />
          <Button size="sm" type="submit">
            <MoveRight aria-hidden /> Sposta qui
          </Button>
        </form>
      )}
    </div>
  );
}

function DayCell({
  date,
  label,
  muted,
  today,
  children,
  month,
}: {
  date: string;
  label: string;
  muted?: boolean;
  today?: boolean;
  children: React.ReactNode;
  month?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-card p-2 transition-colors",
        month ? "min-h-24" : "min-h-28 lg:min-h-64",
        muted && "opacity-50",
        isOver && "border-nx-blue-500 bg-accent/60",
      )}
    >
      <h3
        className={cn("text-xs font-semibold text-muted-foreground", today && "text-primary-text")}
      >
        {label}
        {today && <span className="sr-only"> (oggi)</span>}
      </h3>
      {children}
    </section>
  );
}

export function CalendarBoard({
  view,
  days,
  today,
  items,
  platforms,
  defaultTime,
}: {
  view: "settimana" | "mese";
  days: { date: string; label: string; outside?: boolean }[];
  today: string;
  items: BoardItem[];
  platforms: SocialPlatform[];
  defaultTime: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<string, { date: string; time: string }>>({});
  const [filter, setFilter] = useState<Set<SocialPlatform>>(new Set(platforms));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const shown = useMemo(
    () =>
      items
        .map((i) => ({ ...i, ...(optimistic[i.videoId] ?? {}) }))
        .filter((i) => i.platforms.length === 0 || i.platforms.some((p) => filter.has(p))),
    [items, optimistic, filter],
  );

  function move(videoId: string, date: string, time: string) {
    const prev = optimistic;
    setOptimistic((o) => ({ ...o, [videoId]: { date, time } }));
    startTransition(async () => {
      const res = await moveVideoAction(videoId, date, time);
      if (res.error) {
        setOptimistic(prev);
        toast.error(res.error);
      } else {
        toast.success("Post spostato.");
        router.refresh();
      }
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const item = e.active.data.current as BoardItem | undefined;
    const date = e.over?.id ? String(e.over.id) : null;
    if (!item || !date || date === (optimistic[item.videoId]?.date ?? item.date)) return;
    move(item.videoId, date, optimistic[item.videoId]?.time ?? item.time ?? defaultTime);
  }

  return (
    <div className="grid gap-4" aria-busy={pending}>
      {platforms.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra per social">
          {platforms.map((p) => {
            const on = filter.has(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setFilter((f) => {
                    const n = new Set(f);
                    if (on) n.delete(p);
                    else n.add(p);
                    return n;
                  })
                }
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium",
                  on
                    ? "border-nx-blue-500 bg-accent text-accent-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                {PLATFORM_NAME[p]}
              </button>
            );
          })}
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div
          className={cn(
            "grid gap-2",
            view === "settimana" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-7" : "grid-cols-7",
          )}
        >
          {view === "mese" &&
            ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
              <div
                key={d}
                className="px-1 text-center text-[0.6875rem] font-semibold text-muted-foreground uppercase"
              >
                {d}
              </div>
            ))}
          {days.map((d) => (
            <DayCell
              key={d.date}
              date={d.date}
              label={d.label}
              muted={d.outside || d.date < today}
              today={d.date === today}
              month={view === "mese"}
            >
              {shown
                .filter((i) => i.date === d.date)
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((i) => (
                  <PostCard key={i.videoId} item={i} compact={view === "mese"} onMove={move} />
                ))}
            </DayCell>
          ))}
        </div>
      </DndContext>
      <p className="text-xs text-muted-foreground">
        Trascina un post in un altro giorno (da telefono: tieni premuto la maniglia) oppure usa
        &quot;Sposta&quot;. I post si possono spostare fino a 20 minuti prima dell&apos;uscita.
      </p>
    </div>
  );
}
