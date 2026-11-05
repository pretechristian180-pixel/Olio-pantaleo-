"use client";

import * as Sentry from "@sentry/nextjs";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Errore in una pagina: messaggio chiaro, "Riprova" e ritorno alla Home. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main
      id="contenuto"
      className="mx-auto grid min-h-[60dvh] max-w-md content-center gap-4 px-4 text-center"
    >
      <h1 className="text-2xl font-semibold">Qualcosa non ha funzionato</h1>
      <p className="text-muted-foreground">
        Il problema è stato segnalato al nostro team. Riprova tra un momento: i tuoi dati sono al
        sicuro.
      </p>
      <div className="flex justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw aria-hidden /> Riprova
        </Button>
        <Button variant="outline" asChild>
          <Link href="/inizio">Torna alla Home</Link>
        </Button>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground">Codice: {error.digest}</p>}
    </main>
  );
}
