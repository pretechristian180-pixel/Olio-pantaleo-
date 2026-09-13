import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BottleGlyph } from "@/components/illustrations/BottleGlyph";
import { OliveBranch } from "@/components/illustrations/OliveBranch";
import { ProductCard } from "@/components/ProductCard";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";
import { SensoryProfile } from "@/components/SensoryProfile";
import { ViewProductTracker } from "@/components/ViewProductTracker";
import { JsonLd } from "@/components/JsonLd";
import { accentBg } from "@/lib/accent";
import {
  categoryLabels,
  getProductBySlug,
  getRelatedProducts,
  minPrice,
  products,
} from "@/lib/data/products";
import { recipes } from "@/lib/data/recipes";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.nome,
    description: product.descrizioneBreve,
    openGraph: { title: `${product.nome} — Pantaleo`, description: product.descrizioneBreve },
  };
}

export default async function ProdottoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const relatedProducts = getRelatedProducts(product);
  const relatedRecipes = recipes.filter((r) => product.ricetteCorrelate.includes(r.slug));

  return (
    <>
      <ViewProductTracker slug={product.slug} nome={product.nome} categoria={product.categoria} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.nome,
          description: product.descrizioneBreve,
          brand: { "@type": "Brand", name: "Pantaleo" },
          category: categoryLabels[product.categoria],
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "EUR",
            lowPrice: minPrice(product),
            highPrice: Math.max(...product.formati.map((f) => f.prezzo)),
            offerCount: product.formati.length,
            availability: "https://schema.org/InStock",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pantaleo.it/" },
            { "@type": "ListItem", position: 2, name: "Prodotti", item: "https://www.pantaleo.it/prodotti" },
            {
              "@type": "ListItem",
              position: 3,
              name: product.nome,
              item: `https://www.pantaleo.it/prodotti/${product.slug}`,
            },
          ],
        }}
      />

      <nav aria-label="Breadcrumb" className="container-editorial py-6 text-xs text-bark">
        <Link href="/">Home</Link> <span aria-hidden="true">/</span>{" "}
        <Link href="/prodotti">Prodotti</Link> <span aria-hidden="true">/</span>{" "}
        <span className="text-ink">{product.nome}</span>
      </nav>

      <section className="container-editorial grid gap-14 pb-20 lg:grid-cols-2">
        <div className={`flex aspect-square items-center justify-center rounded-3xl shadow-soft ${accentBg[product.accent]}`}>
          <BottleGlyph accent={product.accent} className="h-4/5 w-auto" />
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-bark">{product.referenza}</p>
          <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">{product.nome}</h1>
          <p className="mt-3 text-lg text-bark">{product.tagline}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {product.idealePer.map((tag) => (
              <span key={tag} className="rounded-full border border-stone px-3 py-1 text-xs text-bark">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-8">
            <ProductPurchasePanel product={product} />
          </div>

          <dl className="mt-10 space-y-3 border-t border-sand pt-6 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-bark">Origine</dt>
              <dd className="text-right text-ink">{product.origine}</dd>
            </div>
            {product.cultivar && (
              <div className="flex justify-between gap-4">
                <dt className="text-bark">Cultivar</dt>
                <dd className="text-right text-ink">{product.cultivar}</dd>
              </div>
            )}
            {product.metodo && (
              <div className="flex justify-between gap-4">
                <dt className="text-bark">Metodo</dt>
                <dd className="text-right text-ink">{product.metodo}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {product.sensoriale && (
        <section className="border-y border-sand bg-ivory py-16">
          <div className="container-editorial grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-serif text-2xl text-ink">Profilo sensoriale</h2>
              <p className="mt-2 max-w-md text-sm text-bark">
                Una lettura descrittiva dei tratti principali di questo olio, così come lo
                percepiamo nei nostri assaggi interni.
              </p>
              <div className="mt-8 max-w-md">
                <SensoryProfile profile={product.sensoriale} />
              </div>
            </div>
            <div>
              <h2 className="font-serif text-2xl text-ink">Gusto</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {product.gusto.map((g) => (
                  <span key={g} className="rounded-full border border-olive-300 bg-paper px-3 py-1.5 text-sm text-olive-800">
                    {g}
                  </span>
                ))}
              </div>
              <h2 className="mt-8 font-serif text-2xl text-ink">Abbinamenti consigliati</h2>
              <ul className="mt-4 space-y-2 text-sm text-bark">
                {product.abbinamenti.map((a) => (
                  <li key={a} className="flex items-center gap-2">
                    <OliveBranch className="h-4 w-6 shrink-0 text-clay-500" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="container-editorial py-20">
        <h2 className="font-serif text-2xl text-ink">La storia di {product.nome}</h2>
        <p className="mt-4 max-w-2xl text-bark">{product.storytelling}</p>
      </section>

      {relatedRecipes.length > 0 && (
        <section className="bg-ivory py-20">
          <div className="container-editorial">
            <h2 className="font-serif text-2xl text-ink">Ricette consigliate</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {relatedRecipes.map((recipe) => (
                <Link key={recipe.slug} href={`/cucina/${recipe.slug}`} className="group block">
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl bg-olive-100 p-6 shadow-soft transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-soft-lg">
                    <OliveBranch className="h-14 w-28 text-olive-700 transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-wide text-bark">
                    {recipe.tempo} · {recipe.difficolta}
                  </p>
                  <h3 className="mt-1 font-serif text-lg text-ink">{recipe.titolo}</h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {relatedProducts.length > 0 && (
        <section className="container-editorial py-20">
          <h2 className="font-serif text-2xl text-ink">Prodotti correlati</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
