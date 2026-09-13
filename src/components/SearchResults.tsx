"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { products } from "@/lib/data/products";
import { recipes } from "@/lib/data/recipes";
import { articles } from "@/lib/data/magazine";
import { track } from "@/lib/analytics";

export function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { prodotti: [], ricette: [], articoli: [] };
    return {
      prodotti: products.filter((p) =>
        `${p.nome} ${p.referenza} ${p.tagline} ${p.gusto.join(" ")}`.toLowerCase().includes(q),
      ),
      ricette: recipes.filter((r) => `${r.titolo} ${r.descrizione}`.toLowerCase().includes(q)),
      articoli: articles.filter((a) => `${a.titolo} ${a.estratto}`.toLowerCase().includes(q)),
    };
  }, [query]);

  const totaleRisultati = results.prodotti.length + results.ricette.length + results.articoli.length;

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set("q", query);
    else params.delete("q");
    router.replace(`/cerca${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });

    if (query.trim()) {
      const timeout = window.setTimeout(() => {
        track({ name: "search", params: { query, risultati: totaleRisultati } });
      }, 500);
      return () => window.clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div>
      <label htmlFor="search-input" className="sr-only">
        Cerca nel sito
      </label>
      <input
        id="search-input"
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca un olio, una ricetta, un articolo…"
        className="w-full border-b-2 border-ink bg-transparent py-4 font-serif text-2xl text-ink placeholder:text-bark/50 focus:outline-none sm:text-3xl"
      />

      {query.trim() && (
        <p className="mt-6 text-sm text-bark">
          {totaleRisultati} {totaleRisultati === 1 ? "risultato" : "risultati"} per &laquo;{query}&raquo;
        </p>
      )}

      {results.prodotti.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif text-xl text-ink">Prodotti</h2>
          <ul className="mt-4 space-y-3">
            {results.prodotti.map((p) => (
              <li key={p.slug}>
                <Link href={`/prodotti/${p.slug}`} className="text-ink hover:text-olive-700">
                  {p.nome} <span className="text-sm text-bark">— {p.tagline}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {results.ricette.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif text-xl text-ink">Ricette</h2>
          <ul className="mt-4 space-y-3">
            {results.ricette.map((r) => (
              <li key={r.slug}>
                <Link href={`/cucina/${r.slug}`} className="text-ink hover:text-olive-700">
                  {r.titolo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {results.articoli.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif text-xl text-ink">Magazine</h2>
          <ul className="mt-4 space-y-3">
            {results.articoli.map((a) => (
              <li key={a.slug}>
                <Link href={`/magazine/${a.slug}`} className="text-ink hover:text-olive-700">
                  {a.titolo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {query.trim() && totaleRisultati === 0 && (
        <p className="mt-10 text-bark">
          Nessun risultato. Prova con &laquo;olio&raquo;, &laquo;ricetta&raquo; o &laquo;Puglia&raquo;.
        </p>
      )}
    </div>
  );
}
