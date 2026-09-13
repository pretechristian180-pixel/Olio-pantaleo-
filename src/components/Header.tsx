"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";

const navLinks = [
  { href: "/prodotti", label: "Prodotti" },
  { href: "/storia", label: "La nostra storia" },
  { href: "/la-puglia", label: "La Puglia" },
  { href: "/cucina", label: "In cucina" },
  { href: "/magazine", label: "Magazine" },
  { href: "/aziende", label: "Per le aziende" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { conteggio, hydrated } = useCart();

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <a href="#contenuto" className="skip-link">
        Vai al contenuto
      </a>
      <header
        className={`sticky top-0 z-50 border-b border-sand/70 bg-paper/95 backdrop-blur transition-[padding] duration-300 ${
          scrolled ? "py-2" : "py-4"
        }`}
      >
        <div className="container-editorial flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-serif text-xl tracking-[0.18em] text-ink sm:text-2xl"
            aria-label="Pantaleo, home page"
          >
            PANTALEO
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigazione principale">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm tracking-wide transition-colors hover:text-olive-700 ${
                  pathname === link.href ? "text-olive-700" : "text-ink/80"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/cerca"
              className="hidden text-sm tracking-wide text-ink/80 hover:text-olive-700 sm:inline-flex"
            >
              Cerca
            </Link>
            <Link
              href="/account"
              className="hidden text-sm tracking-wide text-ink/80 hover:text-olive-700 sm:inline-flex"
            >
              Account
            </Link>
            <Link
              href="/carrello"
              className="relative inline-flex items-center text-sm tracking-wide text-ink/80 hover:text-olive-700"
              aria-label={`Carrello, ${conteggio} articoli`}
            >
              Carrello
              {hydrated && conteggio > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-olive-700 px-1 text-xs font-medium text-paper">
                  {conteggio}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="ml-1 inline-flex flex-col items-center justify-center gap-1.5 lg:hidden"
              aria-label="Apri il menu"
              aria-expanded={menuOpen}
            >
              <span className="block h-px w-6 bg-ink" />
              <span className="block h-px w-6 bg-ink" />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Menu di navigazione"
        >
          <div className="container-editorial flex items-center justify-between py-4">
            <span className="font-serif text-xl tracking-[0.18em]">PANTALEO</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="text-3xl leading-none text-ink"
              aria-label="Chiudi il menu"
            >
              &times;
            </button>
          </div>
          <nav className="container-editorial flex flex-1 flex-col justify-center gap-6" aria-label="Navigazione mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-serif text-4xl text-ink transition-colors hover:text-olive-700"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="container-editorial flex items-center gap-6 border-t border-sand py-6 text-sm tracking-wide">
            <Link href="/cerca">Cerca</Link>
            <Link href="/account">Account</Link>
            <Link href="/carrello">Carrello ({hydrated ? conteggio : 0})</Link>
          </div>
        </div>
      )}
    </>
  );
}
