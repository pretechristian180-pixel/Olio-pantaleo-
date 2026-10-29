import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/labels";

/** Numero grande con etichetta: si legge in un colpo d'occhio. Se ha `to` porta alla lista collegata. */
export function StatCard({
  value,
  label,
  hint,
  to,
  tone = "blue",
  icon,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
  to?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const contenuto = (
    <>
      {icon && (
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5", toneClasses[tone].soft)}>
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[28px] font-bold leading-none tabular-nums">{value}</span>
        <span className="mt-1.5 block text-[15px] leading-snug text-muted-foreground">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted-foreground/80">{hint}</span>}
      </span>
    </>
  );
  const cls = "flex items-start gap-3 rounded-lg border bg-card p-4 shadow-card";
  return to ? (
    <Link to={to} className={cn(cls, "transition-colors hover:border-accent/50")}>
      {contenuto}
    </Link>
  ) : (
    <div className={cls}>{contenuto}</div>
  );
}
