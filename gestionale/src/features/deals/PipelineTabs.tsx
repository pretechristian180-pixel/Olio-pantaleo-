import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Le due pipeline: Vendite (trovare l'acquirente) e Acquisizioni (trovare il proprietario e l'incarico) */
export function PipelineTabs({ className }: { className?: string }) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex h-11 flex-1 items-center justify-center rounded-md px-3 text-[15px] font-semibold transition-colors",
      isActive ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <nav aria-label="Pipeline" className={cn("mb-5 flex rounded-lg bg-muted p-1 sm:max-w-sm", className)}>
      <NavLink to="/trattative" end className={tab}>
        Vendite
      </NavLink>
      <NavLink to="/trattative/acquisizioni" className={tab}>
        Acquisizioni
      </NavLink>
    </nav>
  );
}
