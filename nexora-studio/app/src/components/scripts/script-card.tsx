import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FORMAT_LABELS, STATUS_LABELS, type Script } from "@/lib/scripts";
import { cn } from "@/lib/utils";

const statusVariant = { to_shoot: "warning", uploaded: "success", skipped: "secondary" } as const;

/** Card di uno script nell'elenco della settimana. */
export function ScriptCard({ script, index }: { script: Script; index: number }) {
  const duration = script.shooting_notes?.duration_seconds;
  return (
    <Link
      href={`/script/${script.id}`}
      className={cn(
        "group relative grid gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-nx-blue-500/50 sm:p-5",
        script.status === "skipped" && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-primary-text">
          <span className="font-wordmark">0{index + 1}</span>
          <span className="text-muted-foreground">·</span>
          {FORMAT_LABELS[script.format]}
        </span>
        <Badge variant={statusVariant[script.status]}>{STATUS_LABELS[script.status]}</Badge>
      </div>
      <h3 className="pr-6 text-base font-semibold text-balance sm:text-lg">{script.title}</h3>
      <p className="text-sm text-muted-foreground">«{script.hook}»</p>
      {duration && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden /> circa {duration} secondi
        </span>
      )}
      <ChevronRight
        className="absolute right-4 bottom-4 size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
