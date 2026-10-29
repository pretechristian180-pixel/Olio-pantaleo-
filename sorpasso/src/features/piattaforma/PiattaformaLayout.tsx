import { Suspense } from "react";
import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { Building2, LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { PageLoader } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Area riservata agli amministratori della piattaforma: layout proprio, separato dall'app delle concessionarie. */
export default function PiattaformaLayout() {
  const { caricamento, session, adminPiattaforma, esci, profilo } = useAuth();
  if (caricamento) return <PageLoader />;
  if (!session) return <Navigate to="/accedi?da=%2Fpiattaforma" replace />;
  if (!adminPiattaforma) return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh bg-muted">
      <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/piattaforma" aria-label="Piattaforma Sorpasso">
            <Logo invert altezza={26} />
          </Link>
          <span className="hidden items-center gap-1.5 rounded-full bg-sidebar-surface px-3 py-1 text-sm font-medium text-accent-light sm:inline-flex">
            <ShieldCheck className="size-4" aria-hidden /> Amministrazione piattaforma
          </span>
          <nav className="ml-auto flex items-center gap-1">
            <NavLink
              to="/piattaforma"
              end
              className={({ isActive }) =>
                cn("flex h-10 items-center gap-2 rounded-lg px-3 text-[15px] font-medium", isActive ? "bg-sidebar-surface text-white" : "hover:text-white")
              }
            >
              <Building2 className="size-4" aria-hidden /> Concessionarie
            </NavLink>
            {profilo && (
              <Link to="/" className="hidden h-10 items-center rounded-lg px-3 text-[15px] font-medium hover:text-white sm:flex">
                Vai al gestionale
              </Link>
            )}
            <button
              type="button"
              onClick={() => void esci()}
              className="flex h-10 items-center gap-2 rounded-lg px-3 text-[15px] font-medium hover:bg-sidebar-surface hover:text-white"
            >
              <LogOut className="size-4" aria-hidden /> Esci
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
