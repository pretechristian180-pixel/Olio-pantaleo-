"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Solo il codice dell'errore, nessun dato personale.
    console.error("Errore pagina", error.digest ?? "");
  }, [error]);
  return (
    <main
      id="contenuto"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <Logo />
      <h1 className="text-xl font-semibold">Qualcosa non ha funzionato</h1>
      <p className="max-w-sm text-ink-muted">
        Non siamo riusciti a caricare la pagina. Riprova tra qualche secondo: se il problema resta,
        scrivici.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Riprova</Button>
        <Button asChild variant="secondary">
          <Link href="/">Torna alla home</Link>
        </Button>
      </div>
      {error.digest && <p className="text-xs text-ink-muted">Codice: {error.digest}</p>}
    </main>
  );
}
