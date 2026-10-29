import { Logo } from "@/components/layout/Logo";

/** Mostrata quando mancano le variabili d'ambiente di Supabase. */
export function ConfigurazioneMancante() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-lg rounded-xl border bg-card p-8 shadow-card">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">Manca la configurazione</h1>
        <p className="mt-2 text-muted-foreground">
          Copia <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code> in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code> e inserisci URL e chiave pubblica del progetto Supabase,
          poi riavvia <code className="rounded bg-muted px-1.5 py-0.5">npm run dev</code>.
        </p>
      </div>
    </div>
  );
}
