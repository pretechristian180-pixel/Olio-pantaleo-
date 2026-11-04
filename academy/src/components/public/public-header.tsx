import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="border-b border-white/10 bg-graphite-deep">
      <div className="mx-auto flex h-19 max-w-310 items-center gap-6 px-4 sm:px-6">
        <Logo tone="dark" layout="inline" />
        <nav aria-label="Principale" className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/corsi"
            className="hidden h-11 items-center rounded-md px-3 text-sm font-semibold text-white hover:text-nexora-blue-bright sm:inline-flex"
          >
            Catalogo
          </Link>
          <Link
            href="/aziende"
            className="hidden h-11 items-center rounded-md px-3 text-sm font-medium text-ink-inverse-muted hover:text-white sm:inline-flex"
          >
            Per le aziende
          </Link>
          <Button asChild variant="outline-inverse">
            <Link href="/accedi">Accedi</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
