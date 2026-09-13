import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OliveBranch } from "@/components/illustrations/OliveBranch";
import { ProductCard } from "@/components/ProductCard";
import { RecipeViewTracker } from "@/components/RecipeViewTracker";
import { JsonLd } from "@/components/JsonLd";
import { getRecipeBySlug, recipes } from "@/lib/data/recipes";
import { getProductBySlug } from "@/lib/data/products";

export function generateStaticParams() {
  return recipes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const recipe = getRecipeBySlug(slug);
  if (!recipe) return {};
  return { title: recipe.titolo, description: recipe.descrizione };
}

export default async function RicettaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = getRecipeBySlug(slug);
  if (!recipe) notFound();

  const oli = recipe.oliConsigliati
    .map((s) => getProductBySlug(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <>
      <RecipeViewTracker slug={recipe.slug} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Recipe",
          name: recipe.titolo,
          description: recipe.descrizione,
          recipeCategory: recipe.categoria,
          recipeYield: `${recipe.porzioni} porzioni`,
          totalTime: recipe.tempo,
          recipeIngredient: recipe.ingredienti,
          recipeInstructions: recipe.procedimento.map((step) => ({
            "@type": "HowToStep",
            text: step,
          })),
        }}
      />

      <nav aria-label="Breadcrumb" className="container-editorial py-6 text-xs text-bark">
        <Link href="/">Home</Link> <span aria-hidden="true">/</span>{" "}
        <Link href="/cucina">In cucina</Link> <span aria-hidden="true">/</span>{" "}
        <span className="text-ink">{recipe.titolo}</span>
      </nav>

      <section className="container-editorial grid gap-14 pb-16 lg:grid-cols-2">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl bg-olive-100 p-10 shadow-soft">
          <OliveBranch className="h-24 w-48 text-olive-700" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-bark">{recipe.categoria}</p>
          <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">{recipe.titolo}</h1>
          <p className="mt-4 text-bark">{recipe.descrizione}</p>

          <div className="mt-6 flex gap-8 border-y border-sand py-4 text-sm">
            <div>
              <p className="text-bark">Tempo</p>
              <p className="mt-1 text-ink">{recipe.tempo}</p>
            </div>
            <div>
              <p className="text-bark">Difficoltà</p>
              <p className="mt-1 text-ink">{recipe.difficolta}</p>
            </div>
            <div>
              <p className="text-bark">Porzioni</p>
              <p className="mt-1 text-ink">{recipe.porzioni}</p>
            </div>
          </div>

          <h2 className="mt-8 font-serif text-xl text-ink">Ingredienti</h2>
          <ul className="mt-3 space-y-2 text-sm text-bark">
            {recipe.ingredienti.map((ing) => (
              <li key={ing} className="flex gap-2">
                <span aria-hidden="true">—</span>
                {ing}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-editorial pb-16">
        <h2 className="font-serif text-xl text-ink">Procedimento</h2>
        <ol className="mt-4 max-w-2xl space-y-4">
          {recipe.procedimento.map((step, i) => (
            <li key={i} className="flex gap-4 text-sm text-bark">
              <span className="font-serif text-lg text-olive-700">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {oli.length > 0 && (
        <section className="bg-ivory py-16">
          <div className="container-editorial">
            <h2 className="font-serif text-2xl text-ink">Quale olio usare?</h2>
            <p className="mt-2 max-w-lg text-sm text-bark">
              Per questa ricetta consigliamo:
            </p>
            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
              {oli.map((product) => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
