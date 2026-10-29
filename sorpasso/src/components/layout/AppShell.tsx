import { lazy, Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PageLoader } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { DEMO } from "@/demo/config";
import { BottomNav } from "./BottomNav";
import { Logo } from "./Logo";
import { MenuMobile } from "./MenuMobile";
import { Notifiche } from "./Notifiche";
import { Sidebar } from "./Sidebar";

const NuovoLeadDialog = lazy(() => import("@/features/leads/NuovoLeadDialog"));

/**
 * Struttura comune a tutte le schermate.
 * Telefono: barra in alto (logo, notifiche, menu) e barra in basso con "+ Lead".
 * Desktop: menu laterale blu notte.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const { isAmministrazione } = useSessione();
  const [nuovoLead, setNuovoLead] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-64">
        {DEMO && (
          <div className="bg-accent px-4 py-2 text-center text-sm font-medium text-white">
            Versione dimostrativa con dati di esempio: puoi provare tutto, ma le modifiche non vengono salvate.
          </div>
        )}
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Notifiche />
              <MenuMobile />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav onAdd={isAmministrazione ? undefined : () => setNuovoLead(true)} />
      {nuovoLead && (
        <Suspense fallback={null}>
          <NuovoLeadDialog open={nuovoLead} onOpenChange={setNuovoLead} />
        </Suspense>
      )}
    </div>
  );
}
