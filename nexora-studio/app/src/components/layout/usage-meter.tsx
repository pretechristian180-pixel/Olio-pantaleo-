import { Progress } from "@/components/ui/progress";

/** Contatore d'uso del piano (es. video del mese). */
export function UsageMeter({
  label,
  used,
  total,
  hint,
}: {
  label: string;
  used: number;
  total: number;
  hint?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-display text-sm tabular-nums">
          <span className="text-lg font-semibold">{used}</span>
          <span className="text-muted-foreground"> / {total}</span>
        </span>
      </div>
      <Progress value={pct} aria-label={`${label}: ${used} su ${total}`} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
