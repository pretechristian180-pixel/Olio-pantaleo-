import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { articles, getArticleBySlug } from "@/lib/data/magazine";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  return { title: article.titolo, description: article.estratto };
}

export default async function ArticoloPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const altri = articles.filter((a) => a.slug !== article.slug && a.categoria === article.categoria).slice(0, 3);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.titolo,
          description: article.estratto,
          articleSection: article.categoria,
        }}
      />

      <nav aria-label="Breadcrumb" className="container-editorial py-6 text-xs text-bark">
        <Link href="/">Home</Link> <span aria-hidden="true">/</span>{" "}
        <Link href="/magazine">Magazine</Link> <span aria-hidden="true">/</span>{" "}
        <span className="text-ink">{article.titolo}</span>
      </nav>

      <article className="container-editorial max-w-2xl pb-24">
        <p className="text-xs uppercase tracking-[0.3em] text-clay-600">{article.categoria}</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight text-ink sm:text-5xl">
          {article.titolo}
        </h1>
        <p className="mt-4 text-sm text-bark">{article.tempoLettura} di lettura</p>

        <div className="mt-10 space-y-6 text-lg leading-relaxed text-ink/90">
          {article.corpo.map((paragrafo, i) => (
            <p key={i}>{paragrafo}</p>
          ))}
        </div>
      </article>

      {altri.length > 0 && (
        <section className="bg-ivory py-16">
          <div className="container-editorial">
            <h2 className="font-serif text-2xl text-ink">Altri articoli su {article.categoria}</h2>
            <div className="mt-8 grid gap-10 sm:grid-cols-3">
              {altri.map((a) => (
                <Link key={a.slug} href={`/magazine/${a.slug}`} className="group block">
                  <h3 className="font-serif text-xl text-ink group-hover:text-olive-700">{a.titolo}</h3>
                  <p className="mt-2 text-sm text-bark">{a.estratto}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
