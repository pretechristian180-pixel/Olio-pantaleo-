import Link from "next/link";
import { OliveBranch } from "@/components/illustrations/OliveBranch";

export default function NotFound() {
  return (
    <section className="container-editorial flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <OliveBranch className="h-16 w-32 text-olive-400" />
      <h1 className="mt-8 font-serif text-4xl text-ink">Questa pagina non esiste</h1>
      <p className="mt-4 max-w-md text-bark">
        Forse il ramo che stavi cercando è stato potato. Torna alla home o scopri i nostri oli.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/" className="border border-ink px-7 py-3.5 text-sm tracking-wide hover:bg-ink hover:text-paper">
          Torna alla home
        </Link>
        <Link href="/prodotti" className="bg-ink px-7 py-3.5 text-sm tracking-wide text-paper hover:bg-olive-800">
          Scopri i prodotti
        </Link>
      </div>
    </section>
  );
}
