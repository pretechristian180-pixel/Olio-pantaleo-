import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AgendaPage } from "@/features/agenda/AgendaPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { GuestOnly, RequireAuth } from "@/features/auth/guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { SetPasswordPage } from "@/features/auth/SetPasswordPage";
import { ContactDetailPage } from "@/features/contacts/ContactDetailPage";
import { ContactsPage } from "@/features/contacts/ContactsPage";
import { NewContactPage } from "@/features/contacts/NewContactPage";
import { DealsPage } from "@/features/deals/DealsPage";
import { NewPropertyPage } from "@/features/properties/NewPropertyPage";
import { PropertiesPage } from "@/features/properties/PropertiesPage";
import { PropertyDetailPage } from "@/features/properties/PropertyDetailPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { TodayPage } from "@/features/today/TodayPage";
import { NotFoundPage } from "./NotFoundPage";

export const router = createBrowserRouter([
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
          { path: "contatti", element: <ContactsPage /> },
          { path: "contatti/nuovo", element: <NewContactPage /> },
          { path: "contatti/:id", element: <ContactDetailPage /> },
          { path: "trattative", element: <DealsPage /> },
          { path: "agenda", element: <AgendaPage /> },
          { path: "impostazioni", element: <SettingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
