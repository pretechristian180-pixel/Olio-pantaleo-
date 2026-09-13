import type { Metadata } from "next";
import Link from "next/link";
import { OliveBranch } from "@/components/illustrations/OliveBranch";
import { recipes } from "@/lib/data/recipes";
import { articles } from "@/lib/data/magazine";

export const metadata: Metadata = {
  title: "In cucina con Pantaleo",
  description:
    "Ricette, abbinamenti e cultura dell'olio: il magazine di cucina Pantaleo, con l'olio giusto per ogni piatto.",
};

const cucinaArticles = articles.filter((a) => a.categoria === "Cucina" || a.categoria === "Benessere");

export default function CucinaPage() {
  return (
    <>
      <section className="border-b border-sand bg-ivory py-16">
        <div className="container-editorial">
          <p className="text-xs uppercase tracking-[0.3em] text-clay-600">In cucina con Pantaleo</p>
          <h1 className="mt-4 max-w-2xl text-balance font-serif text-4xl leading-tight text-ink sm:text-5xl">
            Ricette, abbinamenti, cultura dell&apos;olio.
          </h1>
          <p className="mt-4 max-w-xl text-bark">
            Ogni ricetta indica l&apos;olio Pantaleo più adatto: perché il risultato in tavola
            cambia in base a quale bottiglia si sceglie.
          </p>
        </div>
      </section>

      <section className="container-editorial py-16">
        <h2 className="font-serif text-2xl text-ink">Ricette</h2>
        <div className="mt-8 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <Link key={recipe.slug} href={`/cucina/${recipe.slug}`} className="group block">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl bg-olive-100 p-8 shadow-soft transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-soft-lg">
                <OliveBranch className="h-16 w-32 text-olive-700 transition-transform duration-500 group-hover:scale-105" />
              </div>
              <p className="mt-4 text-xs uppercase tracking-wide text-bark">
                {recipe.categoria} · {recipe.tempo} · {recipe.difficolta}
              </p>
              <h3 className="mt-1 font-serif text-xl text-ink group-hover:text-olive-700">
                {recipe.titolo}
              </h3>
              <p className="mt-2 text-sm text-bark">{recipe.descrizione}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-ivory py-16">
        <div className="container-editorial">
          <h2 className="font-serif text-2xl text-ink">Consigli e cultura dell&apos;olio</h2>
          <div className="mt-8 grid gap-10 sm:grid-cols-2">
            {cucinaArticles.map((article) => (
              <Link key={article.slug} href={`/magazine/${article.slug}`} className="group block">
                <p className="text-xs uppercase tracking-wide text-clay-600">{article.categoria}</p>
                <h3 className="mt-2 font-serif text-xl text-ink group-hover:text-olive-700">
                  {article.titolo}
                </h3>
                <p className="mt-2 text-sm text-bark">{article.estratto}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
