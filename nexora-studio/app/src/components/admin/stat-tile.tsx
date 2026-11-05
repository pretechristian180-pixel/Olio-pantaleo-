import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Numero principale con etichetta e nota (stato: icona + testo, mai solo colore). */
export function StatTile({
  label,
  value,
  note,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "good" | "warning" | "critical";
}) {
  return (
    <div className="grid content-start gap-1 rounded-xl border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="font-display text-2xl font-semibold tabular-nums">{value}</span>
      {note && (
        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            tone === "good" && "text-success",
            tone === "warning" && "text-warning",
            tone === "critical" && "text-destructive",
            tone === "default" && "text-muted-foreground",
          )}
        >
          {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
          {note}
        </span>
      )}
    </div>
  );
}
