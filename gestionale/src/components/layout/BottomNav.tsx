import { NavLink } from "react-router-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "./nav";

/** Barra in basso (solo telefono): 5 voci con testo + pulsante "Aggiungi" centrale. */
export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const left = navItems.slice(0, 2);
  const right = navItems.slice(2);
  const item = ({ to, label, icon: Icon }: (typeof navItems)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-1 text-[12px] font-medium leading-none transition-colors",
          isActive ? "text-primary" : "text-muted-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={cn("flex h-8 w-12 items-center justify-center rounded-full", isActive && "bg-primary-soft")}>
            <Icon className="size-[22px]" aria-hidden strokeWidth={isActive ? 2.3 : 1.9} />
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <nav
      aria-label="Menu principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex h-[68px] max-w-lg items-stretch px-1">
        {left.map(item)}
        <div className="flex flex-1 flex-col items-center justify-center">
          <button
            type="button"
            onClick={onAdd}
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-raised ring-4 ring-background active:scale-95"
            aria-label="Aggiungi"
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </button>
          <span className="mt-1 text-[12px] font-medium leading-none text-primary">Aggiungi</span>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}
