import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative } from "@/lib/format";
import { temperatureLabel, toneClasses } from "@/lib/labels";
import type { Acquisition } from "@/types/acquisitions";
import { daysInPhase, lossLabel, STALE_DAYS } from "./labels";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  acquisition: Acquisition;
  /** Pulsante "Sposta in …" (su telefono, dove trascinare è scomodo) */
  nextLabel?: string;
  onNext?: () => void;
  dragging?: boolean;
  overlay?: boolean;
}

export const AcquisitionCard = forwardRef<HTMLDivElement, Props>(function AcquisitionCard(
  { acquisition: a, nextLabel, onNext, dragging, overlay, className, ...rest },
  ref,
) {
  const days = daysInPhase(a.phaseSince);
  const stale = days > STALE_DAYS && a.phase !== "incarico_firmato" && a.phase !== "persa";
  const price = a.valuedPrice ?? a.askingPrice;
  const today = new Date().toLocaleDateString("sv-SE");
  const overdue = a.nextActionDate && a.nextActionDate <= today && a.phase !== "incarico_firmato" && a.phase !== "persa";
  const temp = temperatureLabel[a.temperature];
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card p-4 shadow-card",
        dragging && "opacity-40",
        overlay && "rotate-2 cursor-grabbing shadow-raised",
        rest.onPointerDown && "cursor-grab touch-none",
        className,
      )}
      {...rest}
    >
      <Link to={`/trattative/acquisizioni/${a.id}`} className="block hover:text-primary-strong">
        <p className="flex items-start gap-1.5 text-[17px] font-semibold leading-snug">
          <MapPin className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">{a.address}</span>
        </p>
      </Link>
      <p className="mt-1 truncate text-[15px] text-foreground/80">
        {a.owner ? `${a.owner.firstName} ${a.owner.lastName}`.trim() : <span className="text-muted-foreground">Proprietario da aggiungere</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {price != null && <span className="text-lg font-bold tracking-tight">{formatPrice(price)}</span>}
        <span className={cn("inline-flex items-center gap-1 text-sm", toneClasses[temp.tone].soft, "rounded-full px-2 py-0.5")}>
          <span className={cn("size-1.5 rounded-full", toneClasses[temp.tone].dot)} aria-hidden />
          {temp.label}
        </span>
      </div>
      {a.phase === "persa" && a.lossReason ? (
        <p className="mt-2 text-sm text-muted-foreground">{lossLabel[a.lossReason]}</p>
      ) : (
        <p className={cn("mt-2 flex items-center gap-1.5 text-sm", stale ? "font-semibold text-warning" : "text-muted-foreground")}>
          <Clock className="size-4" aria-hidden />
          {days === 0 ? "In questa fase da oggi" : days === 1 ? "Da 1 giorno in questa fase" : `Da ${days} giorni in questa fase`}
        </p>
      )}
      {overdue && (
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-primary-strong">
          <CalendarClock className="size-4" aria-hidden />
          {a.nextAction || "Da seguire"} · {formatRelative(a.nextActionDate!)}
        </p>
      )}
      {nextLabel && onNext && a.canEdit && (
        <button
          type="button"
          onClick={onNext}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-soft text-[15px] font-semibold text-primary-strong hover:bg-primary/10"
        >
          Sposta in {nextLabel}
          <ArrowRight className="size-5" aria-hidden />
        </button>
      )}
    </div>
  );
});
