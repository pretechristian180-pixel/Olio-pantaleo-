import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative, fullName } from "@/lib/format";
import type { DealWithRefs } from "@/services/api";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  deal: DealWithRefs;
  /** Pulsante "Sposta in …" (su telefono, dove trascinare è scomodo) */
  nextLabel?: string;
  onNext?: () => void;
  dragging?: boolean;
  overlay?: boolean;
}

export const DealCard = forwardRef<HTMLDivElement, Props>(function DealCard(
  { deal: d, nextLabel, onNext, dragging, overlay, className, ...rest },
  ref,
) {
  const rent = d.property?.contract === "affitto";
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
      <div className="flex items-center gap-3">
        {d.contact && <Avatar person={d.contact} size="sm" className={cn(nextLabel ? "" : "hidden 2xl:inline-flex")} />}
        <div className="min-w-0">
          {d.contact ? (
            <Link to={`/contatti/${d.contact.id}`} className="block text-[17px] font-semibold leading-snug hover:text-primary-strong">
              {fullName(d.contact)}
            </Link>
          ) : (
            <p className="text-[17px] font-semibold">Cliente di un collega</p>
          )}
          <p className="text-sm text-muted-foreground">Aggiornata {formatRelative(d.updatedAt)}</p>
        </div>
      </div>
      {d.property && (
        <p className="mt-3 flex items-start gap-1.5 text-[15px] text-foreground/80">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {d.property.address}, {d.property.city}
          </span>
        </p>
      )}
      <p className="mt-2 text-xl font-bold tracking-tight">
        {rent ? `${formatPrice(Math.round(d.value / 12), true)}` : formatPrice(d.value)}
      </p>
      {nextLabel && onNext && d.canEdit && (
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
