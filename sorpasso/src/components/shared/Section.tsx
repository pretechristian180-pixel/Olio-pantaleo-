import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Riquadro bianco con titolo, conteggio opzionale e azione a destra. */
export function Section({
  title,
  count,
  tone,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  count?: number;
  tone?: "red" | "default";
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-card", className)}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold">
          {title}
          {count !== undefined && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums",
                tone === "red" && count > 0 ? "bg-destructive text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          )}
        </h2>
        {action}
      </header>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Coppia etichetta/valore nelle schede di dettaglio. */
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 [&:not(:last-child)]:border-b">
      <dt className="text-[15px] text-muted-foreground">{label}</dt>
      <dd className="text-right text-[15px] font-medium">{children ?? "—"}</dd>
    </div>
  );
}
