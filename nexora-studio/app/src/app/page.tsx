import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-5 py-16">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">Nexora Studio</p>
      <h1 className="text-3xl leading-tight font-semibold text-balance sm:text-4xl">
        I video della tua azienda, ogni settimana. Tu giri, al resto pensiamo noi.
      </h1>
      <p className="text-base text-muted-foreground">
        Ricevi gli script da girare, carica il video dal telefono e ricevilo montato, pronto da
        approvare e pubblicare sui tuoi social.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" disabled>
          Inizia la prova gratuita
        </Button>
        <Button size="lg" variant="outline" disabled>
          Accedi
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Siamo in costruzione: la registrazione apre a breve.
      </p>
    </main>
  );
}
