import { cn } from "@/lib/utils";

/** Numero grande in Michroma con etichetta: per cruscotti studente e admin. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "tint";
  className?: string;
}) {
  const tint = tone === "tint";
  return (
    <div
      className={cn(
        "rounded-lg p-6",
        tint ? "bg-blue-tint" : "border border-line bg-surface",
        className,
      )}
    >
      <p className={cn("text-sm font-medium", tint ? "text-nexora-blue-bright" : "text-ink-muted")}>
        {label}
      </p>
      <p
        className={cn(
          "mt-3 font-display text-4xl leading-none tabular-nums",
          tint ? "text-nexora-blue-bright" : "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
