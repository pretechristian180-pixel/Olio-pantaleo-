import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageLoader } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { supabaseNonConfigurato } from "@/lib/supabase";
import type { Ruolo } from "@/types/db";
import { ConfigurazioneMancante } from "./ConfigurazioneMancante";
import { NotFoundPage } from "./NotFoundPage";

// Ogni pagina è caricata solo quando serve: l'app parte veloce anche su rete mobile.
const AccediPage = lazy(() => import("@/features/auth/AccediPage"));
const RegistratiPage = lazy(() => import("@/features/auth/RegistratiPage"));
const RecuperaPasswordPage = lazy(() => import("@/features/auth/RecuperaPasswordPage"));
const ImpostaPasswordPage = lazy(() => import("@/features/auth/ImpostaPasswordPage"));
const BenvenutoPage = lazy(() => import("@/features/auth/BenvenutoPage"));

const OggiPage = lazy(() => import("@/features/oggi/OggiPage"));
const LeadsPage = lazy(() => import("@/features/leads/LeadsPage"));
const LeadDetailPage = lazy(() => import("@/features/leads/LeadDetailPage"));
const PreventivoPage = lazy(() => import("@/features/leads/PreventivoPage"));
const StockPage = lazy(() => import("@/features/stock/StockPage"));
const VeicoloFormPage = lazy(() => import("@/features/stock/VeicoloFormPage"));
const VeicoloDetailPage = lazy(() => import("@/features/stock/VeicoloDetailPage"));
const AgendaPage = lazy(() => import("@/features/agenda/AgendaPage"));
const ClientiPage = lazy(() => import("@/features/clienti/ClientiPage"));
const ClienteDetailPage = lazy(() => import("@/features/clienti/ClienteDetailPage"));
const PratichePage = lazy(() => import("@/features/pratiche/PratichePage"));
const PraticaDetailPage = lazy(() => import("@/features/pratiche/PraticaDetailPage"));
const ReportPage = lazy(() => import("@/features/report/ReportPage"));
const ImpostazioniPage = lazy(() => import("@/features/impostazioni/ImpostazioniPage"));

/** Pagine riservate: serve la sessione e un profilo collegato a una concessionaria. */
function RichiedeAccesso() {
  const { caricamento, session, senzaProfilo } = useAuth();
  const location = useLocation();
  if (caricamento) return <PageLoader />;
  if (!session) return <Navigate to={`/accedi?da=${encodeURIComponent(location.pathname)}`} replace />;
  if (senzaProfilo) return <Navigate to="/benvenuto" replace />;
  return <AppShell />;
}

/** Limita una pagina ad alcuni ruoli (oltre ai permessi già applicati dal database). */
function SoloRuoli({ ruoli, children }: { ruoli: Ruolo[]; children: ReactNode }) {
  const { profilo } = useAuth();
  if (profilo && !ruoli.includes(profilo.ruolo)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Pubblica() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}

const COMMERCIALE: Ruolo[] = ["titolare", "responsabile_vendite", "venditore"];
const MANAGER: Ruolo[] = ["titolare", "responsabile_vendite"];

export const router = createBrowserRouter(
  supabaseNonConfigurato
    ? [{ path: "*", element: <ConfigurazioneMancante /> }]
    : [
        {
          element: <Pubblica />,
          children: [
            { path: "/accedi", element: <AccediPage /> },
            { path: "/registrati", element: <RegistratiPage /> },
            { path: "/recupera-password", element: <RecuperaPasswordPage /> },
            { path: "/imposta-password", element: <ImpostaPasswordPage /> },
            { path: "/invito", element: <ImpostaPasswordPage invito /> },
            { path: "/benvenuto", element: <BenvenutoPage /> },
          ],
        },
        {
          element: <RichiedeAccesso />,
          children: [
            { index: true, element: <OggiPage /> },
            { path: "lead", element: <SoloRuoli ruoli={COMMERCIALE}><LeadsPage /></SoloRuoli> },
            { path: "lead/:id", element: <LeadDetailPage /> },
            { path: "lead/:id/preventivo", element: <SoloRuoli ruoli={COMMERCIALE}><PreventivoPage /></SoloRuoli> },
            { path: "stock", element: <StockPage /> },
            { path: "stock/nuovo", element: <SoloRuoli ruoli={MANAGER}><VeicoloFormPage /></SoloRuoli> },
            { path: "stock/:id", element: <VeicoloDetailPage /> },
            { path: "stock/:id/modifica", element: <SoloRuoli ruoli={MANAGER}><VeicoloFormPage /></SoloRuoli> },
            { path: "agenda", element: <AgendaPage /> },
            { path: "clienti", element: <ClientiPage /> },
            { path: "clienti/:id", element: <ClienteDetailPage /> },
            { path: "pratiche", element: <PratichePage /> },
            { path: "pratiche/:id", element: <PraticaDetailPage /> },
            { path: "report", element: <SoloRuoli ruoli={MANAGER}><ReportPage /></SoloRuoli> },
            { path: "impostazioni", element: <ImpostazioniPage /> },
            { path: "*", element: <NotFoundPage /> },
          ],
        },
      ],
);
