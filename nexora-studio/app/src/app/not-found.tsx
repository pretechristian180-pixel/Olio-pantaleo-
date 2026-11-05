import Link from "next/link";

import { NexoraLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="contenuto"
      className="mx-auto grid min-h-dvh max-w-md content-center justify-items-center gap-5 px-4 text-center"
    >
      <NexoraLogo />
      <h1 className="text-2xl font-semibold">Pagina non trovata</h1>
      <p className="text-muted-foreground">
        L&apos;indirizzo non esiste o non hai accesso a questa pagina.
      </p>
      <Button asChild>
        <Link href="/">Torna all&apos;inizio</Link>
      </Button>
    </main>
  );
}
