import { Link } from "react-router-dom";
import { CalendarCheck, CalendarPlus, ChevronRight, Clapperboard, FileClock, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionTitle } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { AppointmentItem } from "@/features/agenda/AppointmentItem";
import { useAppointmentDialog } from "@/features/agenda/AppointmentDialog";
import { useQuery } from "@/hooks/useQuery";
import { formatLongDate } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";
import { friendlyError } from "@/lib/errors";
import { getToday, toggleTask } from "@/services/api";
import { countToApprove } from "@/services/studio";
import { ErrorState } from "@/components/shared/ErrorState";
import { TaskList } from "./TaskList";

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export function TodayPage() {
  const { agent } = useAuth();
  const { data, loading, error, reload } = useQuery(getToday);
  const { openAppointment } = useAppointmentDialog();
  const now = new Date();

  async function onToggle(id: string, text: string, wasDone: boolean) {
    try {
      await toggleTask(id, !wasDone);
    } catch (err) {
      toast.error("Modifica non salvata", { description: friendlyError(err) });
      return;
    }
    if (!wasDone) {
      toast.success("Fatto!", {
        description: text,
        action: { label: "Annulla", onClick: () => toggleTask(id, false).catch((e) => toast.error(friendlyError(e))) },
      });
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[17px] text-muted-foreground">{formatLongDate(now)}</p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">
            {greeting(now)}
            {agent?.firstName ? `, ${agent.firstName}` : ""}
          </h1>
        </div>
        {/* Su telefono l'azione rapida è il pulsante "+" in basso */}
        <Button size="lg" className="hidden lg:inline-flex" onClick={() => openAppointment()}>
          <CalendarPlus aria-hidden />
          Nuovo appuntamento
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={reload} className="mb-6" />}

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {error ? null : loading || !data ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[82px] sm:h-[150px]" />)
        ) : (
          <>
            <StatCard value={data.appointments.length} label="appuntamenti oggi" to="/agenda" icon={<CalendarCheck />} />
            <StatCard value={data.newLeads} label="nuovi contatti da richiamare" to="/contatti" tone="brand" icon={<PhoneCall />} />
            <StatCard value={data.expiringMandates} label="incarichi in scadenza" to="/immobili" tone="orange" icon={<FileClock />} />
          </>
        )}
      </div>

      <StudioCard />

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-8">
        <section>
          <SectionTitle
            aside={
              data && data.tasks.length > 0 ? (
                <span className="text-muted-foreground">
                  {data.tasks.filter((t) => t.done).length} di {data.tasks.length} fatte
                </span>
              ) : null
            }
          >
            Cose da fare oggi
          </SectionTitle>
          {error ? null : loading || !data ? (
            <ListSkeleton />
          ) : data.tasks.length === 0 ? (
            <EmptyState
              art="fatto"
              title="Niente da fare per ora"
              text="Quando ci sarà qualcuno da richiamare, te lo ricordiamo qui."
              className="rounded-lg border py-10"
            />
          ) : (
            <TaskList tasks={data.tasks} onToggle={onToggle} />
          )}
        </section>

        <section>
          <SectionTitle>Appuntamenti di oggi</SectionTitle>
          {error ? null : loading || !data ? (
            <ListSkeleton />
          ) : data.appointments.length === 0 ? (
            <EmptyState
              art="calendario"
              title="Nessun appuntamento oggi"
              text="Una giornata libera: puoi fissare una visita."
              action={
                <Button onClick={() => openAppointment()}>
                  <CalendarPlus aria-hidden />
                  Fissa un appuntamento
                </Button>
              }
              className="rounded-lg border py-10"
            />
          ) : (
            <div className="space-y-3">
              {data.appointments.map((a) => (
                <AppointmentItem key={a.id} appt={a} past={new Date(a.start).getTime() + a.durationMin * 60000 < now.getTime()} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Studio: i video da approvare in evidenza; altrimenti un accesso rapido (su telefono non è nel menu) */
function StudioCard() {
  const { data } = useQuery(countToApprove);
  if (data === undefined) return null;
  const pending = data > 0;
  return (
    <Link
      to="/studio"
      className={
        pending
          ? "mt-4 flex items-center gap-4 rounded-lg border border-primary/40 bg-primary-soft p-4 shadow-card sm:mt-6"
          : "mt-4 flex items-center gap-4 rounded-lg border bg-card p-4 shadow-card hover:border-primary/40 sm:mt-6 lg:hidden"
      }
    >
      <span className="relative flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
        <Clapperboard className="size-6" aria-hidden />
        {pending && (
          <span className="absolute -right-2 -top-2 flex min-w-6 items-center justify-center rounded-full bg-foreground px-1.5 text-sm font-bold tabular-nums text-white ring-2 ring-background">
            {data}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold">
          {pending ? (data === 1 ? "1 video da approvare" : `${data} video da approvare`) : "Studio video social"}
        </span>
        <span className="block text-[15px] text-muted-foreground">
          {pending ? "Guardalo e decidi: approva, chiedi modifiche o scarta." : "Crea un Reel di un immobile con il tuo avatar."}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[88px]" />
      ))}
    </div>
  );
}
