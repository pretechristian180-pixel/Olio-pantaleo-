import { Link, NavLink } from "react-router-dom";
import { Avatar } from "@/components/shared/Avatar";
import { cn } from "@/lib/utils";
import { fullName } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";
import { Logo } from "./Logo";
import { navItems } from "./nav";

/** Menu laterale (solo desktop): logo, 5 voci, profilo in basso. */
export function Sidebar() {
  const { agent, agency } = useAuth();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background lg:flex">
      <div className="flex h-18 items-center px-5">
        <Logo />
      </div>
      <nav aria-label="Menu principale" className="mt-2 flex-1 space-y-1 px-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex h-12 items-center gap-3 rounded-lg px-3 text-[16px] font-medium transition-colors",
                isActive ? "bg-primary-soft text-primary" : "text-foreground/80 hover:bg-muted hover:text-foreground",
              )
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      {agent && agency && (
        <Link
          to="/impostazioni"
          title="Profilo e impostazioni"
          className="m-3 flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/60"
        >
          <Avatar person={agent} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{fullName(agent)}</p>
            <p className="truncate text-sm text-muted-foreground">{agency.name}</p>
          </div>
        </Link>
      )}
    </aside>
  );
}
