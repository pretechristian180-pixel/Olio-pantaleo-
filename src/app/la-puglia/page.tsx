import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { PugliaMap } from "@/components/illustrations/PugliaMap";
import { OliveBranch } from "@/components/illustrations/OliveBranch";
import { GroveHorizon } from "@/components/illustrations/GroveHorizon";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "La Puglia",
  description:
    "Fasano, la Valle d'Itria e gli uliveti secolari che da oltre un secolo definiscono il carattere dell'olio Pantaleo.",
};

const tratti = [
  {
    titolo: "Fasano e la Valle d'Itria",
    testo:
      "Il cuore del nostro lavoro è tra Fasano, Cisternino e Locorotondo: una terra di muretti a secco, trulli e uliveti che in alcuni casi hanno centinaia di anni.",
  },
  {
    titolo: "Un clima mediterraneo",
    testo:
      "Estati calde e asciutte, inverni miti, vento costante dal mare: condizioni che da sempre favoriscono la coltivazione dell'olivo in questa parte di Puglia.",
  },
  {
    titolo: "Cultivar autoctone",
    testo:
      "Coratina, Ogliarola e Cima di Bitonto sono le varietà che lavoriamo ogni anno, spesso in blend, per bilanciare intensità, dolcezza e note erbacee.",
  },
  {
    titolo: "La raccolta",
    testo:
      "Tra ottobre e dicembre, la raccolta segue ancora oggi i tempi della pianta più che quelli del calendario, per portare in frantoio olive nel momento giusto di maturazione.",
  },
];

export default function LaPugliaPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pantaleo.it/" },
            { "@type": "ListItem", position: 2, name: "La Puglia", item: "https://www.pantaleo.it/la-puglia" },
          ],
        }}
      />

      <section className="relative flex min-h-[60vh] flex-col justify-end overflow-hidden bg-olive-900 text-paper bg-grain">
        <div className="container-editorial relative pb-20 pt-32">
          <p className="text-xs uppercase tracking-[0.3em] text-olive-200">Il territorio</p>
          <h1 className="mt-6 max-w-3xl text-balance font-serif text-5xl leading-tight sm:text-6xl">
            L&apos;olio nasce dalla terra.
            <br />
            <span className="italic text-gold-400">La nostra storia, dalla Puglia.</span>
          </h1>
        </div>
        <GroveHorizon className="h-20 w-full text-olive-950/40" />
      </section>

      <section className="container-editorial py-24">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <Reveal>
            <PugliaMap className="mx-auto w-full max-w-sm text-olive-800" />
          </Reveal>
          <Reveal delay={100}>
            <div className="grid gap-10 sm:grid-cols-2">
              {tratti.map((t) => (
                <div key={t.titolo}>
                  <OliveBranch className="h-6 w-14 text-clay-500" />
                  <h3 className="mt-3 font-serif text-xl text-ink">{t.titolo}</h3>
                  <p className="mt-2 text-sm text-bark">{t.testo}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-ivory py-24">
        <div className="container-editorial">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-clay-600">Dalla terra alla bottiglia</p>
            <h2 className="mt-4 max-w-2xl text-balance font-serif text-4xl leading-tight text-ink">
              Un percorso breve, per restare fedeli al frutto.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-10 sm:grid-cols-4">
            {[
              { step: "01", titolo: "Raccolta", testo: "Olive raccolte a mano o con agevolatori meccanici, per non danneggiare il frutto." },
              { step: "02", titolo: "Trasporto", testo: "Dal campo al frantoio nel minor tempo possibile, per limitare l'ossidazione." },
              { step: "03", titolo: "Molitura a freddo", testo: "Estrazione meccanica, senza uso di calore, per preservare aromi e polifenoli." },
              { step: "04", titolo: "Imbottigliamento", testo: "Conservazione al riparo da luce e calore, fino all'imbottigliamento delle singole referenze." },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 80}>
                <div className="rounded-3xl bg-paper p-6 shadow-soft transition-transform hover:-translate-y-1">
                <p className="font-serif text-3xl text-olive-300">{s.step}</p>
                <h3 className="mt-2 font-serif text-xl text-ink">{s.titolo}</h3>
                <p className="mt-2 text-sm text-bark">{s.testo}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-editorial py-24 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-balance font-serif text-3xl text-ink sm:text-4xl">
            Scopri come questo territorio diventa il gusto di ogni bottiglia.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/storia" className="rounded-full border border-ink px-7 py-3.5 text-sm tracking-wide transition-colors hover:bg-ink hover:text-paper">
              La nostra storia
            </Link>
            <Link href="/prodotti" className="rounded-full bg-ink px-7 py-3.5 text-sm tracking-wide text-paper transition-colors hover:bg-olive-800">
              Scopri i nostri oli
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
