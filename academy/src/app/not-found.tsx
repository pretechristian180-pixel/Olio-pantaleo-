import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main
      id="contenuto"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <Logo />
      <p className="font-display text-5xl">404</p>
      <h1 className="text-xl font-semibold">Questa pagina non esiste</h1>
      <p className="max-w-sm text-ink-muted">
        Forse il link è vecchio o il corso è stato spostato.
      </p>
      <Button asChild>
        <Link href="/corsi">Vai al catalogo</Link>
      </Button>
    </main>
  );
}
