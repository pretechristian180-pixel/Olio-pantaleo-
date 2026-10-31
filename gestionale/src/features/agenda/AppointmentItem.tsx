import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, MessageSquareQuote } from "lucide-react";
import { AppointmentBadge } from "@/components/shared/badges";
import { VisitFeedbackDialog } from "@/features/records/VisitFeedback";
import { appointmentKind, toneClasses } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { formatTime, fullName } from "@/lib/format";
import type { AppointmentWithRefs } from "@/services/api";

/** Riga appuntamento: orario grande a sinistra, chi e dove a destra. Dopo una visita: "Com'è andata?". */
export function AppointmentItem({ appt, past }: { appt: AppointmentWithRefs; past?: boolean }) {
  const tone = appointmentKind[appt.kind].tone;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const askFeedback = past && appt.kind === "visita" && !!appt.contact;
  return (
    <div className={cn("rounded-lg border border-l-4 bg-card shadow-card", toneClasses[tone].bar)}>
      <Link
        to={appt.contact ? `/contatti/${appt.contact.id}` : "/agenda"}
        className={cn("flex gap-4 rounded-lg p-4 transition-colors hover:bg-muted/50", past && "opacity-60")}
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
      {askFeedback && (
        <>
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="flex h-12 w-full items-center justify-center gap-2 border-t text-[15px] font-semibold text-primary-strong hover:bg-primary-soft/50"
          >
            <MessageSquareQuote className="size-5" aria-hidden />
            Com'è andata la visita?
          </button>
          <VisitFeedbackDialog
            open={feedbackOpen}
            onOpenChange={setFeedbackOpen}
            visit={{
              appointmentId: appt.id,
              contactId: appt.contactId,
              propertyId: appt.propertyId ?? null,
              title: [appt.contact ? fullName(appt.contact) : null, appt.property?.address].filter(Boolean).join(" · "),
            }}
          />
        </>
      )}
    </div>
  );
}
