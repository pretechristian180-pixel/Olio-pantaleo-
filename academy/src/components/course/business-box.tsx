import Link from "next/link";

/** Box "Hai un team da formare?" (mockup Corso). */
export function BusinessBox() {
  return (
    <aside className="rounded-lg bg-blue-tint p-7">
      <h2 className="text-lg font-semibold text-nexora-blue-deep">Hai un team da formare?</h2>
      <p className="mt-3 text-sm leading-6 text-ink">
        Accessi multipli per la tua azienda, con un report sull&apos;avanzamento di ogni
        collaboratore.
      </p>
      <Link
        href="/aziende"
        className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-nexora-blue-deep underline underline-offset-2 hover:text-nexora-blue"
      >
        Richiedi l&apos;offerta aziende
      </Link>
    </aside>
  );
}
