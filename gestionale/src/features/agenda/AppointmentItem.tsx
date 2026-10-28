import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { AppointmentBadge } from "@/components/shared/badges";
import { appointmentKind, toneClasses } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { formatTime, fullName } from "@/lib/format";
import type { AppointmentWithRefs } from "@/services/api";

/** Riga appuntamento: orario grande a sinistra, chi e dove a destra. */
export function AppointmentItem({ appt, past }: { appt: AppointmentWithRefs; past?: boolean }) {
  const tone = appointmentKind[appt.kind].tone;
  return (
    <Link
      to={appt.contact ? `/contatti/${appt.contact.id}` : "/agenda"}
      className={cn(
        "flex gap-4 rounded-lg border border-l-4 bg-card p-4 shadow-card transition-colors hover:bg-muted/50",
        toneClasses[tone].bar,
        past && "opacity-60",
      )}
    >
      <div className="w-14 shrink-0">
        <p className="text-lg font-bold tabular-nums leading-tight">{formatTime(appt.start)}</p>
        <p className="text-sm text-muted-foreground">{appt.durationMin} min</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[17px] font-semibold">{appt.contact ? fullName(appt.contact) : "Cliente"}</p>
          <AppointmentBadge kind={appt.kind} />
        </div>
        {appt.property && (
          <p className="mt-1 flex items-start gap-1.5 text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {appt.property.address}, {appt.property.city}
            </span>
          </p>
        )}
        {appt.note && <p className="mt-1 text-[15px] text-muted-foreground">{appt.note}</p>}
      </div>
    </Link>
  );
}
