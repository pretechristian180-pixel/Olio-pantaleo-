import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/labels";

/** Card con numero grande: si legge in un colpo d'occhio e porta alla lista collegata. */
export function StatCard({
  value,
  label,
  to,
  tone = "brand",
  icon,
}: {
  value: number;
  label: string;
  to: string;
  tone?: Tone;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-lg border bg-card p-4 shadow-card transition-colors hover:border-primary/40 sm:flex-col sm:items-start sm:gap-3 sm:p-5"
    >
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg [&_svg]:size-6", toneClasses[tone].soft)}>
        {icon}
      </span>
      <span className="flex flex-1 items-center gap-4 sm:w-full sm:flex-col sm:items-start sm:gap-1">
        <span className="text-4xl font-bold tabular-nums leading-none">{value}</span>
        <span className="flex-1 text-[17px] leading-snug text-muted-foreground">{label}</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:hidden" aria-hidden />
    </Link>
  );
}
