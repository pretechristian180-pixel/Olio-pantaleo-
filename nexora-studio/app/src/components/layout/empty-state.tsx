import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Stato vuoto: spiega sempre cosa succede e qual è il prossimo passo. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <div className="relative flex size-12 items-center justify-center rounded-full bg-accent text-primary-text">
        <span className="absolute inset-0 rounded-full ring-1 ring-nx-blue-500/30" aria-hidden />
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="grid max-w-sm gap-1.5">
        <p className="font-display text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
