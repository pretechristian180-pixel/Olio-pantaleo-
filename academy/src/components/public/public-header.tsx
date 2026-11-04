import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="bg-graphite-deep">
      <div className="mx-auto flex h-18 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo tone="dark" />
        <nav aria-label="Principale" className="ml-auto flex items-center gap-2">
          <Link
            href="/corsi"
            className="hidden h-11 items-center rounded-md px-3 text-sm font-medium text-white/80 hover:text-white sm:inline-flex"
          >
            Catalogo
          </Link>
          <Button asChild variant="outline-inverse">
            <Link href="/accedi">Accedi</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
