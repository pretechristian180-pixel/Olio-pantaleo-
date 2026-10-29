import { CookieBanner } from "@/componenti/CookieBanner";
import { Footer } from "@/componenti/Footer";
import { BarraMobile, Header } from "@/componenti/Header";
import { useRivela } from "@/lib/rivela";
import { CookiePolicy } from "@/pagine/CookiePolicy";
import { Privacy } from "@/pagine/Privacy";
import { Calcolatore } from "@/sezioni/Calcolatore";
import { ComeFunziona } from "@/sezioni/ComeFunziona";
import { Faq } from "@/sezioni/Faq";
import { Funzionalita, PerChi } from "@/sezioni/Funzionalita";
import { Hero } from "@/sezioni/Hero";
import { ModuloDemo } from "@/sezioni/ModuloDemo";
import { Pacchetti } from "@/sezioni/Pacchetti";
import { Problema } from "@/sezioni/Problema";
import { ProvaSociale } from "@/sezioni/ProvaSociale";

/** Tre pagine soltanto: basta un semplice instradamento sul percorso. */
export function App() {
  const percorso = window.location.pathname.replace(/\/+$/, "") || "/";
  useRivela(percorso);

  let pagina;
  if (percorso === "/privacy") pagina = <Privacy />;
  else if (percorso === "/cookie-policy") pagina = <CookiePolicy />;
  else
    pagina = (
      <main>
        <Hero />
        <Problema />
        <Calcolatore />
        <ComeFunziona />
        <Funzionalita />
        <PerChi />
        <ProvaSociale />
        <Pacchetti />
        <Faq />
        <ModuloDemo />
      </main>
    );

  return (
    <>
      <a href="#demo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2">
        Vai al modulo di prenotazione
      </a>
      <Header />
      {pagina}
      <Footer />
      {percorso === "/" && <BarraMobile />}
      <CookieBanner />
    </>
  );
}
