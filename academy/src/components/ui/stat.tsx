import { cn } from "@/lib/utils";

/** Numero grande in Michroma con etichetta: per cruscotti studente e admin. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-5", className)}>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-3 font-display text-3xl leading-none text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
