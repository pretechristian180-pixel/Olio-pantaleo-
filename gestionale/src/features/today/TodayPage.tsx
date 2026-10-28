import { CalendarCheck, CalendarPlus, FileClock, PhoneCall } from "lucide-react";
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
import { getSession, getToday, toggleTask } from "@/services/api";
import { TaskList } from "./TaskList";

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export function TodayPage() {
  const { agent } = getSession();
  const { data, loading } = useQuery(getToday);
  const { openAppointment } = useAppointmentDialog();
  const now = new Date();

  async function onToggle(id: string, text: string, wasDone: boolean) {
    await toggleTask(id);
    if (!wasDone) {
      toast.success("Fatto!", {
        description: text,
        action: { label: "Annulla", onClick: () => toggleTask(id) },
      });
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[17px] text-muted-foreground">{formatLongDate(now)}</p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">
            {greeting(now)}, {agent.firstName}
          </h1>
        </div>
        {/* Su telefono l'azione rapida è il pulsante "+" in basso */}
        <Button size="lg" className="hidden lg:inline-flex" onClick={() => openAppointment()}>
          <CalendarPlus aria-hidden />
          Nuovo appuntamento
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {loading || !data ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[82px] sm:h-[150px]" />)
        ) : (
          <>
            <StatCard value={data.appointments.length} label="appuntamenti oggi" to="/agenda" icon={<CalendarCheck />} />
            <StatCard value={data.newLeads} label="nuovi contatti da richiamare" to="/contatti" tone="orange" icon={<PhoneCall />} />
            <StatCard value={data.expiringMandates} label="incarichi in scadenza" to="/immobili" tone="amber" icon={<FileClock />} />
          </>
        )}
      </div>

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
          {loading || !data ? (
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
          {loading || !data ? (
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

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[88px]" />
      ))}
    </div>
  );
}
