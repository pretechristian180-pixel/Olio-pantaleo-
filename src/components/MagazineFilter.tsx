"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { articles, type ArticleCategory } from "@/lib/data/magazine";

const categorie: ArticleCategory[] = [
  "Storia",
  "Puglia",
  "Olio",
  "Cucina",
  "Benessere",
  "Territorio",
  "Innovazione",
];

export function MagazineFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attiva = searchParams.get("categoria") as ArticleCategory | null;

  function setCategoria(cat: ArticleCategory | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (cat) params.set("categoria", cat);
    else params.delete("categoria");
    router.replace(`/magazine${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  }

  const filtrati = useMemo(
    () => (attiva ? articles.filter((a) => a.categoria === attiva) : articles),
    [attiva],
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoria(null)}
          aria-pressed={!attiva}
          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
            !attiva ? "border-ink bg-ink text-paper" : "border-stone text-ink hover:border-ink"
          }`}
        >
          Tutte
        </button>
        {categorie.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoria(attiva === cat ? null : cat)}
            aria-pressed={attiva === cat}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              attiva === cat ? "border-ink bg-ink text-paper" : "border-stone text-ink hover:border-ink"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {filtrati.map((article) => (
          <Link key={article.slug} href={`/magazine/${article.slug}`} className="group block rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-ivory hover:shadow-soft">
            <p className="text-xs uppercase tracking-wide text-clay-600">{article.categoria}</p>
            <h3 className="mt-2 font-serif text-2xl leading-snug text-ink group-hover:text-olive-700">
              {article.titolo}
            </h3>
            <p className="mt-3 text-sm text-bark">{article.estratto}</p>
            <p className="mt-3 text-xs text-bark">{article.tempoLettura} di lettura</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
