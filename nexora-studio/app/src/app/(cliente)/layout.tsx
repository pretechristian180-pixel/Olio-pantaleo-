import { AppShell } from "@/components/layout/app-shell";

/**
 * Area cliente.
 * TODO Fase 1: utente e workspace reali dalla sessione Supabase, con redirect a /accedi
 * per chi non ha effettuato l'accesso. Per ora dati dimostrativi per la base grafica.
 */
export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      user={{ name: "Mario Rossi", email: "mario@pizzeriadamario.it" }}
      workspace={{ name: "Pizzeria Da Mario", planLabel: "Prova gratuita" }}
    >
      {children}
    </AppShell>
  );
}
