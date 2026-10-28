import { createBrowserRouter, createMemoryRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AgendaPage } from "@/features/agenda/AgendaPage";
import { ContactDetailPage } from "@/features/contacts/ContactDetailPage";
import { ContactsPage } from "@/features/contacts/ContactsPage";
import { NewContactPage } from "@/features/contacts/NewContactPage";
import { DealsPage } from "@/features/deals/DealsPage";
import { NewPropertyPage } from "@/features/properties/NewPropertyPage";
import { PropertiesPage } from "@/features/properties/PropertiesPage";
import { PropertyDetailPage } from "@/features/properties/PropertyDetailPage";
import { TodayPage } from "@/features/today/TodayPage";
import { NotFoundPage } from "./NotFoundPage";

/**
 * Tutte le rotte dell'app. Quando arriverà l'autenticazione Supabase,
 * AppShell verrà avvolto da una rotta protetta (es. <RequireAuth>) e si aggiungerà /accedi.
 */
const routes = [
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
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

// Nell'anteprima condivisa l'indirizzo non si può cambiare: lì la navigazione resta in memoria.
export const router =
  import.meta.env.MODE === "anteprima" ? createMemoryRouter(routes) : createBrowserRouter(routes);
