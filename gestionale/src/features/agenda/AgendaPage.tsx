import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useQuery } from "@/hooks/useQuery";
import { appointmentKind, toneClasses } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { addDays, formatLongDate, formatTime, fullName, isSameDay, startOfDay, startOfWeek } from "@/lib/format";
import { listAppointments, type AppointmentWithRefs } from "@/services/api";
import type { AppointmentKind } from "@/types/domain";
import { useAppointmentDialog } from "./AppointmentDialog";
import { AppointmentItem } from "./AppointmentItem";

type View = "giorno" | "settimana";

const FIRST_HOUR = 8;
const LAST_HOUR = 20;
const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
const weekdayShort = (d: Date) => d.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", "");

export function AgendaPage() {
  const isDesktop = useIsDesktop();
  // Giornaliera predefinita su telefono, settimanale su desktop
  const [view, setView] = useState<View | null>(null);
  const currentView: View = view ?? (isDesktop ? "settimana" : "giorno");
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const { openAppointment } = useAppointmentDialog();

  const weekStart = startOfWeek(day);
  const from = currentView === "giorno" ? day : weekStart;
  const to = addDays(from, currentView === "giorno" ? 1 : 7);
  const { data, loading, error, reload } = useQuery(() => listAppointments(from, to), [from.getTime(), to.getTime()]);

  const step = currentView === "giorno" ? 1 : 7;
  const today = startOfDay(new Date());
  const isToday = isSameDay(day, today);

  const title =
    currentView === "giorno"
      ? isToday
        ? `Oggi, ${formatLongDate(day).toLowerCase()}`
        : formatLongDate(day)
      : weekRange(weekStart);

  return (
    <div>
      <PageHeader
        title="Agenda"
        action={
          <Button size="lg" onClick={() => openAppointment({ start: defaultStart(day) })}>
            <CalendarPlus aria-hidden />
            Nuovo appuntamento
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Vista"
          value={currentView}
          onChange={setView}
          className="sm:w-72"
          options={[
            { value: "giorno", label: "Giorno" },
            { value: "settimana", label: "Settimana" },
          ]}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-11" onClick={() => setDay(addDays(day, -step))}>
            <ChevronLeft aria-hidden />
            Prima
          </Button>
          <Button variant="outline" size="sm" className="h-11 flex-1 sm:flex-none" onClick={() => setDay(today)} disabled={isToday}>
            Oggi
          </Button>
          <Button variant="outline" size="sm" className="h-11" onClick={() => setDay(addDays(day, step))}>
            Dopo
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Legend />
      </div>

      {currentView === "giorno" && <WeekStrip day={day} onPick={setDay} />}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : currentView === "giorno" ? (
        <DayView day={day} items={data} onFree={(start) => openAppointment({ start })} />
      ) : isDesktop ? (
        <WeekGrid weekStart={weekStart} items={data} onFree={(start) => openAppointment({ start })} onPickDay={(d) => {
          setDay(d);
          setView("giorno");
        }} />
      ) : (
        <WeekList weekStart={weekStart} items={data} onAdd={(d) => openAppointment({ start: defaultStart(d) })} />
      )}
    </div>
  );
}

function weekRange(start: Date) {
  const end = addDays(start, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const first = start.getMonth() === end.getMonth() ? String(start.getDate()) : start.toLocaleDateString("it-IT", opts);
  return `${first} – ${end.toLocaleDateString("it-IT", opts)}`;
}

function defaultStart(day: Date) {
  const d = new Date(day);
  const now = new Date();
  d.setHours(isSameDay(d, now) ? Math.min(now.getHours() + 1, LAST_HOUR - 1) : 10, 0, 0, 0);
  return d;
}

function Legend() {
  return (
    <ul className="flex gap-4 text-[15px] text-muted-foreground">
      {(["visita", "valutazione", "firma"] as AppointmentKind[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded-full", toneClasses[appointmentKind[k].tone].dot)} aria-hidden />
          {appointmentKind[k].label}
        </li>
      ))}
    </ul>
  );
}

/** Striscia con i 7 giorni della settimana per cambiare giorno con un tocco. */
function WeekStrip({ day, onPick }: { day: Date; onPick: (d: Date) => void }) {
  const start = startOfWeek(day);
  const today = new Date();
  return (
    <div className="mb-5 grid grid-cols-7 gap-1.5">
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
        const selected = isSameDay(d, day);
        return (
          <button
            key={d.toISOString()}
            type="button"
            onClick={() => onPick(d)}
            aria-pressed={selected}
            className={cn(
              "flex h-16 flex-col items-center justify-center rounded-lg text-sm font-medium capitalize transition-colors",
              selected ? "bg-primary text-white" : "bg-muted text-foreground/80 hover:bg-primary-soft",
            )}
          >
            {weekdayShort(d)}
            <span className={cn("text-lg font-bold leading-tight", !selected && isSameDay(d, today) && "text-primary")}>
              {d.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Vista giornaliera: una riga per ogni ora. Le ore libere si toccano per aggiungere. */
function DayView({ day, items, onFree }: { day: Date; items: AppointmentWithRefs[]; onFree: (start: Date) => void }) {
  const now = new Date();
  const rows: React.ReactNode[] = [];
  let busyUntil = 0;

  for (const h of hours) {
    const slot = new Date(day);
    slot.setHours(h, 0, 0, 0);
    const startingHere = items.filter((a) => new Date(a.start).getHours() === h);
    if (startingHere.length) {
      startingHere.forEach((a) => {
        busyUntil = Math.max(busyUntil, new Date(a.start).getTime() + a.durationMin * 60000);
      });
      rows.push(
        <div key={h} className="space-y-2">
          {startingHere.map((a) => (
            <AppointmentItem key={a.id} appt={a} past={new Date(a.start).getTime() + a.durationMin * 60000 < now.getTime()} />
          ))}
        </div>,
      );
      continue;
    }
    if (slot.getTime() < busyUntil) continue;
    const past = slot.getTime() + 3600000 < now.getTime();
    rows.push(
      <button
        key={h}
        type="button"
        disabled={past}
        onClick={() => onFree(slot)}
        className="group flex h-14 w-full items-center gap-4 rounded-lg border border-dashed border-border px-4 text-left transition-colors hover:border-primary hover:bg-primary-soft/50 disabled:opacity-40"
      >
        <span className="w-14 text-[17px] font-semibold tabular-nums text-muted-foreground">{String(h).padStart(2, "0")}:00</span>
        <span className="flex-1 text-muted-foreground group-hover:text-primary">Libero</span>
        {!past && (
          <span className="flex items-center gap-1 text-[15px] font-medium text-primary">
            <Plus className="size-4" aria-hidden />
            Aggiungi
          </span>
        )}
      </button>,
    );
  }

  return <div className="space-y-2">{rows}</div>;
}

/** Vista settimanale su telefono: elenco per giorno, semplice da scorrere. */
function WeekList({ weekStart, items, onAdd }: { weekStart: Date; items: AppointmentWithRefs[]; onAdd: (d: Date) => void }) {
  if (items.length === 0)
    return (
      <EmptyState
        art="calendario"
        title="Settimana libera"
        text="Nessun appuntamento in questi giorni."
        action={<Button onClick={() => onAdd(weekStart)}>Fissa un appuntamento</Button>}
      />
    );
  return (
    <div className="space-y-6">
      {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
        const dayItems = items.filter((a) => isSameDay(new Date(a.start), d));
        return (
          <section key={d.toISOString()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className={cn("text-[17px] font-semibold", isSameDay(d, new Date()) && "text-primary")}>{formatLongDate(d)}</h3>
              <button type="button" onClick={() => onAdd(d)} className="flex h-11 items-center gap-1 px-2 text-[15px] font-medium text-primary">
                <Plus className="size-4" aria-hidden />
                Aggiungi
              </button>
            </div>
            {dayItems.length ? (
              <div className="space-y-2">
                {dayItems.map((a) => (
                  <AppointmentItem key={a.id} appt={a} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-muted px-4 py-3 text-muted-foreground">Nessun appuntamento</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

const HOUR_PX = 60;

/** Vista settimanale su desktop: griglia oraria, clic su uno spazio libero per aggiungere. */
function WeekGrid({
  weekStart,
  items,
  onFree,
  onPickDay,
}: {
  weekStart: Date;
  items: AppointmentWithRefs[];
  onFree: (start: Date) => void;
  onPickDay: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b">
        <div />
        {days.map((d) => (
          <button
            key={d.toISOString()}
            type="button"
            onClick={() => onPickDay(d)}
            className="border-l py-3 text-center hover:bg-muted"
            title="Apri la giornata"
          >
            <span className="block text-sm capitalize text-muted-foreground">{weekdayShort(d)}</span>
            <span
              className={cn(
                "mx-auto mt-0.5 flex size-9 items-center justify-center rounded-full text-lg font-semibold",
                isSameDay(d, today) && "bg-primary text-white",
              )}
            >
              {d.getDate()}
            </span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[64px_repeat(7,1fr)]">
        <div>
          {hours.map((h) => (
            <div key={h} className="pr-2 pt-1 text-right text-sm tabular-nums text-muted-foreground" style={{ height: HOUR_PX }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dayItems = items.filter((a) => isSameDay(new Date(a.start), d));
          return (
            <div key={d.toISOString()} className="relative border-l">
              {hours.map((h) => {
                const slot = new Date(d);
                slot.setHours(h, 0, 0, 0);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onFree(slot)}
                    aria-label={`Aggiungi appuntamento ${formatLongDate(d)} alle ${h}:00`}
                    className="group block w-full border-b border-border/70 text-left hover:bg-primary-soft/60"
                    style={{ height: HOUR_PX }}
                  >
                    <span className="hidden px-2 pt-1 text-sm font-medium text-primary group-hover:block">+ Aggiungi</span>
                  </button>
                );
              })}
              {dayItems.map((a) => {
                const s = new Date(a.start);
                const top = (s.getHours() - FIRST_HOUR + s.getMinutes() / 60) * HOUR_PX;
                const height = Math.max((a.durationMin / 60) * HOUR_PX - 4, 40);
                const tone = toneClasses[appointmentKind[a.kind].tone];
                return (
                  <Link
                    key={a.id}
                    to={a.contact ? `/contatti/${a.contact.id}` : "/agenda"}
                    className={cn("absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-2 py-1 text-sm leading-tight", tone.soft, tone.bar)}
                    style={{ top: top + 2, height }}
                  >
                    <span className="font-semibold">{formatTime(a.start)}</span> {appointmentKind[a.kind].label}
                    <span className="block truncate text-foreground/80">{a.contact ? fullName(a.contact) : ""}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
