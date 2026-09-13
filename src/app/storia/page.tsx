import type { Metadata } from "next";
import Link from "next/link";
import { StoryTimeline } from "@/components/StoryTimeline";
import { Reveal } from "@/components/Reveal";
import { GroveHorizon } from "@/components/illustrations/GroveHorizon";
import { SectionCurve } from "@/components/illustrations/SectionCurve";
import { timeline } from "@/lib/data/timeline";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "La nostra storia",
  description:
    "Dal 1890 a oggi: quattro generazioni della famiglia Pantaleo a Fasano, tra terra, famiglia, esperienza e innovazione.",
};

export default function StoriaPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pantaleo.it/" },
            { "@type": "ListItem", position: 2, name: "La nostra storia", item: "https://www.pantaleo.it/storia" },
          ],
        }}
      />

      <section className="relative flex min-h-[60vh] flex-col justify-end overflow-hidden bg-forest-900 text-paper bg-grain">
        <div className="container-editorial relative pb-20 pt-32">
          <p className="text-xs uppercase tracking-[0.3em] text-olive-200">1890 — oggi</p>
          <h1 className="mt-6 max-w-3xl text-balance font-serif text-5xl leading-tight sm:text-6xl">
            Terra, famiglia, esperienza, <span className="italic text-gold-400">innovazione.</span>
          </h1>
          <p className="mt-6 max-w-xl text-ivory/90">
            Quattro generazioni della famiglia Pantaleo hanno attraversato oltre 130 anni senza mai
            lasciare il proprio frantoio a Fasano. Questa è la storia di come è successo.
          </p>
        </div>
        <GroveHorizon className="h-20 w-full text-forest-800" />
      </section>

      <section className="container-editorial py-24">
        <StoryTimeline events={timeline} />
      </section>

      <section className="relative bg-olive-900 py-24 text-paper">
        <div className="absolute inset-x-0 top-0 -translate-y-[calc(100%-1px)] text-olive-900">
          <SectionCurve className="h-14 w-full sm:h-20" />
        </div>
        <div className="container-editorial grid gap-10 sm:grid-cols-4">
          {["Terra", "Famiglia", "Esperienza", "Innovazione"].map((word, i) => (
            <Reveal key={word} delay={i * 90}>
              <p className="font-serif text-3xl">{word}</p>
              <p className="mt-2 text-sm text-olive-200">
                {
                  [
                    "Gli uliveti della Valle d'Itria, lavorati senza interruzione da oltre un secolo.",
                    "Quattro generazioni della stessa famiglia, nello stesso frantoio.",
                    "Decenni di raccolte, assaggi e scelte che si sono affinate nel tempo.",
                    "Nuove linee di prodotto e nuovi modi di raccontare un mestiere antico.",
                  ][i]
                }
              </p>
            </Reveal>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 translate-y-[calc(100%-1px)] text-paper">
          <SectionCurve className="h-14 w-full sm:h-20" flip />
        </div>
      </section>

      <section className="container-editorial py-24 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-balance font-serif text-3xl text-ink sm:text-4xl">
            Una storia che continua ogni giorno, in ogni bottiglia.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/la-puglia" className="rounded-full border border-ink px-7 py-3.5 text-sm tracking-wide transition-colors hover:bg-ink hover:text-paper">
              Scopri il territorio
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
