import Link from "next/link";
import { Newsletter } from "@/components/Newsletter";
import { OliveBranch } from "@/components/illustrations/OliveBranch";

const columns = [
  {
    title: "Prodotti",
    links: [
      { href: "/prodotti?categoria=premium", label: "Oli Premium" },
      { href: "/prodotti?categoria=aromatizzati", label: "Aromatizzati" },
      { href: "/prodotti?categoria=squeezable", label: "Squeezable" },
      { href: "/prodotti?categoria=kit-degustazione", label: "Kit Assaggio" },
      { href: "/trova-il-tuo-olio", label: "Trova il tuo olio" },
    ],
  },
  {
    title: "Il brand",
    links: [
      { href: "/storia", label: "La nostra storia" },
      { href: "/la-puglia", label: "La Puglia" },
      { href: "/cucina", label: "In cucina" },
      { href: "/magazine", label: "Magazine" },
      { href: "/aziende", label: "Per le aziende" },
    ],
  },
  {
    title: "Assistenza",
    links: [
      { href: "/account", label: "Il tuo account" },
      { href: "/carrello", label: "Carrello" },
      { href: "/aziende", label: "Contatti B2B" },
      { href: "/cerca", label: "Cerca nel sito" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-sand bg-ivory">
      <div className="container-editorial py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3 text-olive-700">
              <OliveBranch className="h-8 w-16" />
            </div>
            <p className="mt-4 font-serif text-2xl">PANTALEO</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-bark">
              Dal 1890, quattro generazioni della famiglia Pantaleo lavorano gli uliveti della
              Valle d&apos;Itria, a Fasano, in provincia di Brindisi.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-serif text-lg text-ink">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-sm text-bark hover:text-olive-700">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t border-sand pt-10">
          <Newsletter origine="footer" />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-sand pt-6 text-xs text-bark sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Pantaleo — Frantoio Oleario, Fasano (BR). Tutti i diritti riservati.</p>
          <div className="flex gap-5">
            <Link href="/" className="hover:text-olive-700">
              Privacy
            </Link>
            <Link href="/" className="hover:text-olive-700">
              Termini
            </Link>
            <Link href="/" className="hover:text-olive-700">
              Cookie
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
