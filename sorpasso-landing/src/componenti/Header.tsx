import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { LinkPulsante } from "./Pulsante";
import { hero } from "@/contenuti";

const VOCI = [
  { href: "/#come-funziona", label: "Come funziona" },
  { href: "/#calcolatore", label: "Calcolatore" },
  { href: "/#pacchetti", label: "Pacchetti" },
  { href: "/#faq", label: "Domande" },
];

export function Header() {
  const [scorso, setScorso] = useState(false);
  useEffect(() => {
    const f = () => setScorso(window.scrollY > 12);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${scorso ? "border-b border-line bg-bg/85 backdrop-blur-md" : "bg-transparent"}`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
        <a href="/" aria-label="Sorpasso AI, torna all'inizio">
          <Logo />
        </a>
        <nav aria-label="Sezioni" className="ml-auto hidden items-center gap-7 text-[15px] text-muted md:flex">
          {VOCI.map((v) => (
            <a key={v.href} href={v.href} className="transition-colors hover:text-text">
              {v.label}
            </a>
          ))}
        </nav>
        {/* Su telefono la CTA è nella barra fissa in basso */}
        <div className="ml-auto hidden sm:block md:ml-0">
          <LinkPulsante href="/#demo" className="!h-11 !px-5 !text-[15px]">
            {hero.cta}
          </LinkPulsante>
        </div>
      </div>
    </header>
  );
}

/** Su telefono: CTA sempre a portata di pollice. Si nasconde quando il form è visibile. */
export function BarraMobile() {
  const [nascosta, setNascosta] = useState(false);
  useEffect(() => {
    const form = document.getElementById("demo");
    if (!form || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setNascosta(!!e?.isIntersecting), { threshold: 0.05 });
    io.observe(form);
    return () => io.disconnect();
  }, []);
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 px-4 pt-3 pb-safe backdrop-blur-md transition-transform duration-300 sm:hidden ${nascosta ? "translate-y-full" : ""}`}
      aria-hidden={nascosta}
    >
      <LinkPulsante href="/#demo" className="w-full" tabIndex={nascosta ? -1 : 0}>
        {hero.cta}
      </LinkPulsante>
    </div>
  );
}
