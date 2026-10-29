import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { AppointmentDialogProvider } from "@/features/agenda/AppointmentDialog";
import { Avatar } from "@/components/shared/Avatar";
import { useAuth } from "@/features/auth/AuthProvider";
import { BottomNav } from "./BottomNav";
import { GlobalSearch, SearchTrigger } from "./GlobalSearch";
import { Logo } from "./Logo";
import { QuickAddSheet } from "./QuickAddSheet";
import { Sidebar } from "./Sidebar";

/**
 * Struttura comune a tutte le schermate.
 * Telefono: barra in alto con logo e ricerca, barra di navigazione in basso.
 * Desktop: menu laterale stretto a sinistra, ricerca in alto.
 */
export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { pathname } = useLocation();
  const { agent } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <AppointmentDialogProvider>
      <div className="min-h-dvh bg-background">
        <Sidebar />
        <div className="lg:pl-60">
          {import.meta.env.MODE === "anteprima" && (
            <div className="bg-warning-soft px-4 py-2 text-center text-[15px] text-warning">
              Anteprima con dati di esempio: le modifiche si perdono ricaricando la pagina.
            </div>
          )}
          <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:h-18 lg:px-8">
              <div className="lg:hidden">
                <Logo />
              </div>
              <SearchTrigger onOpen={() => setSearchOpen(true)} className="ml-auto hidden max-w-md lg:ml-0 lg:flex" />
              {/* Su telefono il profilo (e le Impostazioni) si apre da qui */}
              {agent && (
                <Link
                  to="/impostazioni"
                  className="ml-auto flex h-11 items-center gap-2 rounded-lg px-1.5 font-medium text-foreground/80 lg:hidden"
                >
                  <Avatar person={agent} size="sm" className="size-8 text-[13px]" />
                  Profilo
                </Link>
              )}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-11 items-center gap-2 rounded-lg border px-3.5 font-medium text-foreground/80 lg:hidden"
              >
                <Search className="size-5" aria-hidden />
                Cerca
              </button>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
            <Outlet />
          </main>
        </div>
        <BottomNav onAdd={() => setAddOpen(true)} />
        <QuickAddSheet open={addOpen} onOpenChange={setAddOpen} />
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </AppointmentDialogProvider>
  );
}

