import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Titolo della schermata + l'unica azione principale. Su telefono il pulsante va a tutta larghezza. */
export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-[17px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="[&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xl font-semibold">{children}</h2>
      {aside}
    </div>
  );
}
