import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { ProductCard } from "@/components/ProductCard";
import { GroveHorizon } from "@/components/illustrations/GroveHorizon";
import { OliveBranch } from "@/components/illustrations/OliveBranch";
import { PugliaMap } from "@/components/illustrations/PugliaMap";
import { getProductBySlug } from "@/lib/data/products";
import { timeline } from "@/lib/data/timeline";
import { recipes } from "@/lib/data/recipes";
import { articles } from "@/lib/data/magazine";

const prodottiInEvidenza = [
  getProductBySlug("selezione-oro")!,
  getProductBySlug("igp-puglia")!,
  getProductBySlug("oronovo")!,
  getProductBySlug("kit-degustazione")!,
];

const ricetteInEvidenza = recipes.slice(0, 3);
const articoliInEvidenza = articles.slice(0, 3);

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[92vh] flex-col justify-between overflow-hidden bg-forest-900 text-paper bg-grain">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 15% -10%, rgba(176,141,62,0.35), transparent 60%), radial-gradient(90% 70% at 90% 110%, rgba(102,122,53,0.55), transparent 60%)",
          }}
        />
        <div className="container-editorial relative flex flex-1 flex-col justify-center pt-28 pb-16 sm:pt-32">
          <p className="text-xs uppercase tracking-[0.3em] text-olive-200">
            Fasano, Puglia — dal 1890
          </p>
          <h1 className="mt-6 max-w-4xl text-balance font-serif text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            Dal 1890,
            <br />
            <span className="italic text-gold-400">la cultura dell&apos;olio.</span>
          </h1>
          <p className="mt-6 max-w-xl text-balance text-lg text-ivory/90">
            Quattro generazioni di esperienza pugliese, una cultura dell&apos;olio che continua a
            evolversi.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/storia"
              className="border border-paper px-7 py-3.5 text-sm tracking-wide transition-colors hover:bg-paper hover:text-forest-900"
            >
              SCOPRI PANTALEO
            </Link>
            <Link
              href="/prodotti"
              className="bg-gold-500 px-7 py-3.5 text-sm tracking-wide text-forest-900 transition-colors hover:bg-gold-400"
            >
              SCOPRI I NOSTRI OLI
            </Link>
          </div>
        </div>
        <GroveHorizon className="relative h-24 w-full text-forest-800 sm:h-32" />
      </section>

      {/* CIFRE ISTITUZIONALI */}
      <section className="border-b border-sand bg-ivory">
        <div className="container-editorial grid grid-cols-1 divide-y divide-sand sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { cifra: "Oltre 130 anni", testo: "di storia della famiglia Pantaleo a Fasano" },
            { cifra: "4 generazioni", testo: "che si sono succedute nello stesso frantoio" },
            { cifra: "1 territorio", testo: "la Valle d'Itria, in Puglia, mai abbandonata" },
          ].map((item) => (
            <div key={item.cifra} className="py-10 text-center sm:px-8">
              <p className="font-serif text-2xl text-olive-800">{item.cifra}</p>
              <p className="mt-2 text-sm text-bark">{item.testo}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STORIA TEASER */}
      <section className="container-editorial py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-clay-600">La nostra storia</p>
            <h2 className="mt-4 text-balance font-serif text-4xl leading-tight text-ink sm:text-5xl">
              Terra, famiglia, esperienza, innovazione.
            </h2>
            <p className="mt-6 max-w-lg text-bark">
              Dal 1890 a oggi, la storia di Pantaleo è quella di una sola famiglia che non ha mai
              smesso di lavorare la stessa terra. Non un logo che cambia gestione, ma quattro
              generazioni che si sono passate lo stesso frantoio.
            </p>
            <Link
              href="/storia"
              className="mt-8 inline-flex items-center gap-2 border-b border-ink pb-1 text-sm tracking-wide text-ink hover:text-olive-700"
            >
              Scopri la timeline completa →
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <div className="space-y-6 border-l border-olive-300 pl-8">
              {timeline.map((event) => (
                <div key={event.year}>
                  <p className="font-serif text-2xl text-olive-800">{event.year}</p>
                  <p className="text-sm text-bark">{event.title}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* LA PUGLIA TEASER */}
      <section className="bg-olive-900 py-24 text-paper">
        <div className="container-editorial grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <div className="mx-auto max-w-xs text-olive-100">
              <PugliaMap className="w-full" />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-xs uppercase tracking-[0.3em] text-olive-300">La Puglia</p>
            <h2 className="mt-4 text-balance font-serif text-4xl leading-tight sm:text-5xl">
              L&apos;olio nasce dalla terra.
              <br />
              La nostra storia, dalla Puglia.
            </h2>
            <p className="mt-6 max-w-lg text-olive-100">
              Lavoriamo tra Fasano e la Valle d&apos;Itria, dove uliveti secolari, muretti a secco e
              la luce del Mediterraneo definiscono il carattere di ogni raccolta.
            </p>
            <Link
              href="/la-puglia"
              className="mt-8 inline-flex items-center gap-2 border-b border-paper pb-1 text-sm tracking-wide hover:text-gold-400"
            >
              Esplora il territorio →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* PRODOTTI */}
      <section className="container-editorial py-24">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-clay-600">Prodotti</p>
              <h2 className="mt-4 text-balance font-serif text-4xl leading-tight text-ink sm:text-5xl">
                Che olio stai cercando?
              </h2>
            </div>
            <Link
              href="/trova-il-tuo-olio"
              className="whitespace-nowrap border border-ink px-6 py-3 text-sm tracking-wide text-ink hover:bg-ink hover:text-paper"
            >
              Trova il tuo olio Pantaleo
            </Link>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="rail mt-10 flex gap-3 overflow-x-auto pb-2 sm:flex-wrap">
            {[
              ["Per cucinare", "cucinare"],
              ["Per condire a crudo", "crudo"],
              ["Per regalare", "regalare"],
              ["Per scoprire", "scoprire"],
              ["Per ogni giorno", "ogni-giorno"],
              ["Per gli appassionati", "appassionati"],
            ].map(([label]) => (
              <Link
                key={label}
                href={`/prodotti?uso=${encodeURIComponent(label)}`}
                className="whitespace-nowrap border border-stone px-4 py-2 text-sm text-ink hover:border-ink"
              >
                {label.toUpperCase()}
              </Link>
            ))}
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-4">
          {prodottiInEvidenza.map((product, i) => (
            <Reveal key={product.slug} delay={i * 70}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/prodotti"
            className="inline-flex border border-ink px-7 py-3.5 text-sm tracking-wide text-ink hover:bg-ink hover:text-paper"
          >
            Vedi tutti i prodotti
          </Link>
        </div>
      </section>

      {/* CUCINA */}
      <section className="bg-ivory py-24">
        <div className="container-editorial">
          <Reveal>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-clay-600">In cucina</p>
                <h2 className="mt-4 text-balance font-serif text-4xl leading-tight text-ink sm:text-5xl">
                  Un olio diverso per ogni piatto.
                </h2>
              </div>
              <Link
                href="/cucina"
                className="whitespace-nowrap text-sm tracking-wide text-ink underline underline-offset-4 hover:text-olive-700"
              >
                Vai al magazine di cucina →
              </Link>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {ricetteInEvidenza.map((recipe, i) => (
              <Reveal key={recipe.slug} delay={i * 80}>
                <Link href={`/cucina/${recipe.slug}`} className="group block">
                  <div className="flex aspect-[4/3] items-center justify-center bg-olive-100 p-6">
                    <OliveBranch className="h-16 w-32 text-olive-700 transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-wide text-bark">
                    {recipe.categoria} · {recipe.tempo} · {recipe.difficolta}
                  </p>
                  <h3 className="mt-1 font-serif text-xl text-ink">{recipe.titolo}</h3>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* MAGAZINE */}
      <section className="container-editorial py-24">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-clay-600">Magazine</p>
              <h2 className="mt-4 text-balance font-serif text-4xl leading-tight text-ink sm:text-5xl">
                Storia, Puglia, cultura dell&apos;olio.
              </h2>
            </div>
            <Link
              href="/magazine"
              className="whitespace-nowrap text-sm tracking-wide text-ink underline underline-offset-4 hover:text-olive-700"
            >
              Tutti gli articoli →
            </Link>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {articoliInEvidenza.map((article, i) => (
            <Reveal key={article.slug} delay={i * 80}>
              <Link href={`/magazine/${article.slug}`} className="group block">
                <p className="text-xs uppercase tracking-wide text-clay-600">{article.categoria}</p>
                <h3 className="mt-2 font-serif text-2xl leading-snug text-ink group-hover:text-olive-700">
                  {article.titolo}
                </h3>
                <p className="mt-3 text-sm text-bark">{article.estratto}</p>
                <p className="mt-3 text-xs text-bark">{article.tempoLettura} di lettura</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* B2B */}
      <section className="bg-ink py-20 text-paper">
        <div className="container-editorial flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Per le aziende</p>
            <h2 className="mt-3 max-w-xl text-balance font-serif text-3xl leading-tight sm:text-4xl">
              Dalla nostra esperienza, il tuo prodotto.
            </h2>
          </div>
          <Link
            href="/aziende"
            className="whitespace-nowrap border border-paper px-7 py-3.5 text-sm tracking-wide hover:bg-paper hover:text-ink"
          >
            PARLA CON PANTALEO
          </Link>
        </div>
      </section>
    </>
  );
}
