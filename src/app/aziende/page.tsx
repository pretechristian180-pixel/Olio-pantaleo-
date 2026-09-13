import type { Metadata } from "next";
import { B2BContactForm } from "@/components/B2BContactForm";
import { Reveal } from "@/components/Reveal";
import { GroveHorizon } from "@/components/illustrations/GroveHorizon";
import { OliveBranch } from "@/components/illustrations/OliveBranch";

export const metadata: Metadata = {
  title: "Pantaleo per le aziende",
  description:
    "Private label, produzione conto terzi e distribuzione: la nostra esperienza olearia al servizio di buyer, distributori e operatori Horeca.",
};

const capacita = [
  {
    titolo: "Produzione",
    testo:
      "Lavoriamo nei nostri frantoi di Fasano, con impianti di estrazione a freddo e controlli di qualità su ogni lotto in ingresso e in uscita.",
  },
  {
    titolo: "Private label",
    testo:
      "Sviluppiamo referenze a marchio del cliente a partire dalla nostra gamma di oli, adattando blend, formati ed etichette alle esigenze del progetto.",
  },
  {
    titolo: "Packaging",
    testo:
      "Bottiglie, lattine e formati bag-in-box, con possibilità di personalizzazione grafica in base ai volumi e al canale di vendita.",
  },
  {
    titolo: "Controllo qualità",
    testo:
      "Ogni partita viene sottoposta ad assaggio interno prima dell'imbottigliamento, per garantire coerenza tra un lotto e l'altro.",
  },
  {
    titolo: "Distribuzione",
    testo:
      "Supportiamo clienti Horeca, retail e distributori con logistica dedicata e referenti commerciali diretti.",
  },
  {
    titolo: "Supporto",
    testo:
      "Un referente unico segue il progetto dalla prima richiesta alla consegna, per semplificare la comunicazione tra i team.",
  },
];

export default function AziendePage() {
  return (
    <>
      <section className="relative flex min-h-[55vh] flex-col justify-end overflow-hidden bg-ink text-paper bg-grain">
        <div className="container-editorial relative pb-16 pt-32">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Pantaleo per le aziende</p>
          <h1 className="mt-6 max-w-2xl text-balance font-serif text-5xl leading-tight sm:text-6xl">
            Dalla nostra esperienza, <span className="italic text-gold-400">il tuo prodotto.</span>
          </h1>
          <p className="mt-6 max-w-xl text-ivory/80">
            Oltre 130 anni di lavoro in frantoio al servizio di buyer, distributori, aziende e
            operatori Horeca che cercano un partner nella produzione olearia.
          </p>
        </div>
        <GroveHorizon className="h-16 w-full text-forest-900" />
      </section>

      <section className="container-editorial py-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {capacita.map((c, i) => (
            <Reveal key={c.titolo} delay={i * 60}>
              <OliveBranch className="h-6 w-14 text-clay-500" />
              <h2 className="mt-3 font-serif text-xl text-ink">{c.titolo}</h2>
              <p className="mt-2 text-sm text-bark">{c.testo}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-ivory py-20">
        <div className="container-editorial grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-clay-600">Parla con Pantaleo</p>
            <h2 className="mt-4 max-w-md text-balance font-serif text-3xl leading-tight text-ink sm:text-4xl">
              Raccontaci il tuo progetto, ti risponderemo con una proposta su misura.
            </h2>
            <p className="mt-4 max-w-md text-sm text-bark">
              Che tu stia valutando una linea private label, un accordo di distribuzione o una
              fornitura Horeca, il nostro team commerciale è il primo punto di contatto.
            </p>
          </div>
          <B2BContactForm />
        </div>
      </section>
    </>
  );
}
