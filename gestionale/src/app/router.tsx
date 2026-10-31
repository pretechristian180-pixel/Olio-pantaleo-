import { createBrowserRouter, createMemoryRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AgendaPage } from "@/features/agenda/AgendaPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { AdminAgenciesPage } from "@/features/admin/AdminAgenciesPage";
import { AdminAgencyPage } from "@/features/admin/AdminAgencyPage";
import { AdminShell } from "@/features/admin/AdminShell";
import { GuestOnly, RequireAdmin, RequireAuth } from "@/features/auth/guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { SetPasswordPage } from "@/features/auth/SetPasswordPage";
import { ContactDetailPage } from "@/features/contacts/ContactDetailPage";
import { ContactsPage } from "@/features/contacts/ContactsPage";
import { NewContactPage } from "@/features/contacts/NewContactPage";
import { AcquisitionDetailPage } from "@/features/acquisitions/AcquisitionDetailPage";
import { AcquisitionsPage } from "@/features/acquisitions/AcquisitionsPage";
import { DealDetailPage } from "@/features/deals/DealDetailPage";
import { DealsPage } from "@/features/deals/DealsPage";
import { NewPropertyPage } from "@/features/properties/NewPropertyPage";
import { PropertiesPage } from "@/features/properties/PropertiesPage";
import { PropertyDetailPage } from "@/features/properties/PropertyDetailPage";
import { PropertyPhotosPage } from "@/features/properties/PropertyPhotosPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { NewVideoPage } from "@/features/studio/NewVideoPage";
import { PublicApprovalPage } from "@/features/studio/PublicApprovalPage";
import { StudioPage } from "@/features/studio/StudioPage";
import { StudioSettingsPage } from "@/features/studio/StudioSettingsPage";
import { VideoPage } from "@/features/studio/VideoPage";
import { TodayPage } from "@/features/today/TodayPage";
import { NotFoundPage } from "./NotFoundPage";

const routes = [
  {
    element: <GuestOnly />,
    children: [
      { path: "accedi", element: <LoginPage /> },
      { path: "registrati", element: <RegisterPage /> },
      { path: "password-dimenticata", element: <ForgotPasswordPage /> },
    ],
  },
  // Raggiunta dal link di invito o di recupero password (l'utente è già collegato dal link)
  { path: "imposta-password", element: <SetPasswordPage /> },
  // Approvazione di un video dal link WhatsApp: pubblica, protetta dal token monouso
  { path: "approva/:token", element: <PublicApprovalPage /> },
  // Pannello admin della piattaforma (solo amministratori di Mattonio)
  {
    element: <RequireAdmin />,
    children: [
      {
        path: "admin",
        element: <AdminShell />,
        children: [
          { index: true, element: <AdminAgenciesPage /> },
          { path: "agenzie/:id", element: <AdminAgencyPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <TodayPage /> },
          { path: "immobili", element: <PropertiesPage /> },
          { path: "immobili/nuovo", element: <NewPropertyPage /> },
          { path: "immobili/:id", element: <PropertyDetailPage /> },
          { path: "immobili/:id/foto", element: <PropertyPhotosPage /> },
          { path: "contatti", element: <ContactsPage /> },
          { path: "contatti/nuovo", element: <NewContactPage /> },
          { path: "contatti/:id", element: <ContactDetailPage /> },
          { path: "trattative", element: <DealsPage /> },
          { path: "trattative/vendita/:id", element: <DealDetailPage /> },
          { path: "trattative/acquisizioni", element: <AcquisitionsPage /> },
          { path: "trattative/acquisizioni/:id", element: <AcquisitionDetailPage /> },
          { path: "agenda", element: <AgendaPage /> },
          { path: "impostazioni", element: <SettingsPage /> },
          { path: "studio", element: <StudioPage /> },
          { path: "studio/nuovo/:propertyId", element: <NewVideoPage /> },
          { path: "studio/video/:id", element: <VideoPage /> },
          { path: "studio/video/:id/modifica", element: <NewVideoPage /> },
          { path: "studio/impostazioni", element: <StudioSettingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

// Nell'anteprima pubblicata l'indirizzo della pagina non si può cambiare: la navigazione resta in memoria
export const router = import.meta.env.MODE === "anteprima" ? createMemoryRouter(routes) : createBrowserRouter(routes);
