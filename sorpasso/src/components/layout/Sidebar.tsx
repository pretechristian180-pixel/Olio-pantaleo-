import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { useAuth, useSessione } from "@/lib/auth";
import { RUOLI } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { navPerRuolo } from "./nav";

/** Menu laterale blu notte (solo desktop). */
export function Sidebar() {
  const { profilo, organizzazione, ruolo } = useSessione();
  const { esci } = useAuth();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-18 items-center px-5">
        <Logo invert />
      </div>
      <p className="mx-5 mb-3 truncate text-sm text-sidebar-foreground/70">{organizzazione.nome}</p>
      <nav aria-label="Menu principale" className="flex-1 space-y-1 px-3">
        {navPerRuolo(ruolo).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "relative flex h-12 items-center gap-3 rounded-lg px-3 text-[16px] font-medium transition-colors",
                isActive ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-y-2.5 left-0 w-1 rounded-r bg-accent" aria-hidden />}
                <Icon className={cn("size-5", isActive && "text-accent")} aria-hidden />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-lg bg-white/5 p-3">
        <Avatar nome={profilo.nome} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{profilo.nome}</p>
          <p className="truncate text-sm">{RUOLI[ruolo]}</p>
        </div>
        <button
          type="button"
          onClick={() => void esci()}
          className="flex size-10 items-center justify-center rounded-lg hover:bg-white/10 hover:text-white"
          aria-label="Esci"
          title="Esci"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
