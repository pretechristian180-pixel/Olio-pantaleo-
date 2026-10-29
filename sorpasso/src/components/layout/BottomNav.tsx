import { NavLink } from "react-router-dom";
import { Plus } from "lucide-react";
import { useSessione } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { navPerRuolo, type NavItem } from "./nav";

/** Barra in basso (solo telefono): 4 voci + "Nuovo lead" al centro, raggiungibile col pollice. */
export function BottomNav({ onAdd }: { onAdd?: () => void }) {
  const { ruolo } = useSessione();
  const voci = navPerRuolo(ruolo).filter((i) => i.mobile);
  const meta = Math.ceil(voci.length / 2);
  const item = ({ to, label, icon: Icon }: NavItem) => (
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
          <span className={cn("flex h-8 w-12 items-center justify-center rounded-full", isActive && "bg-accent-soft text-accent")}>
            <Icon className="size-[22px]" aria-hidden strokeWidth={isActive ? 2.3 : 1.9} />
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <nav aria-label="Menu principale" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur lg:hidden">
      <div className="mx-auto flex h-[68px] max-w-lg items-stretch px-1">
        {voci.slice(0, meta).map(item)}
        {onAdd && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <button
              type="button"
              onClick={onAdd}
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-raised ring-4 ring-background active:scale-95"
              aria-label="Nuovo lead"
            >
              <Plus className="size-7" strokeWidth={2.5} aria-hidden />
            </button>
            <span className="mt-1 text-[12px] font-medium leading-none text-accent">Lead</span>
          </div>
        )}
        {voci.slice(meta).map(item)}
      </div>
    </nav>
  );
}
