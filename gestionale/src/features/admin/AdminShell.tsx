import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/features/auth/AuthProvider";
import { cn } from "@/lib/utils";

/** Struttura del pannello admin: barra in alto, niente menu dell'agenzia. */
export function AdminShell() {
  const { agent, signOut } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background">
      {import.meta.env.MODE === "anteprima" && (
        <div className="bg-warning-soft px-4 py-2 text-center text-[15px] text-warning">
          Anteprima con dati di esempio: le modifiche si perdono ricaricando la pagina.
        </div>
      )}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/admin" className="flex items-center gap-2.5">
            <Logo />
            <Badge tone="navy" dot={false}>
              Admin
            </Badge>
          </Link>
          <nav aria-label="Pannello admin" className="ml-4 hidden sm:block">
            <NavLink
              to="/admin"
              end={false}
              className={({ isActive }) =>
                cn("rounded-lg px-3 py-2 font-medium", isActive ? "bg-primary-soft text-primary-strong" : "text-muted-foreground hover:bg-muted")
              }
            >
              Agenzie
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {agent && (
              <Button variant="ghost" size="sm" className="hidden h-11 sm:inline-flex" asChild>
                <Link to="/">
                  <ArrowLeft aria-hidden />
                  Vai al gestionale
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-11" onClick={signOut}>
              Esci
            </Button>
          </div>
        </div>
        {/* Su telefono il ritorno al gestionale sta in una riga a parte */}
        {agent && (
          <div className="border-t px-4 sm:hidden">
            <Link to="/" className="flex h-11 items-center gap-2 text-[15px] font-medium text-muted-foreground">
              <ArrowLeft className="size-4" aria-hidden />
              Vai al gestionale
            </Link>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
