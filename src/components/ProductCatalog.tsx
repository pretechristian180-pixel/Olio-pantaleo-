"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { track } from "@/lib/analytics";
import {
  categoryLabels,
  products,
  type OilCategory,
  type Product,
  type UsoTag,
} from "@/lib/data/products";

const usoOptions: UsoTag[] = [
  "Per cucinare",
  "Per condire a crudo",
  "Per regalare",
  "Per scoprire",
  "Per ogni giorno",
  "Per gli appassionati",
];

const categoriaOptions: OilCategory[] = ["premium", "aromatizzati", "squeezable", "kit-degustazione"];

export function ProductCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categoriaAttiva = searchParams.get("categoria") as OilCategory | null;
  const usoAttivo = searchParams.get("uso") as UsoTag | null;
  const [query, setQuery] = useState("");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`/prodotti${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
    if (value) track({ name: "filter_product", params: { filtro: key, valore: value } });
  }

  const filtered: Product[] = useMemo(() => {
    return products.filter((p) => {
      if (categoriaAttiva && p.categoria !== categoriaAttiva) return false;
      if (usoAttivo && !p.idealePer.includes(usoAttivo)) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack = `${p.nome} ${p.referenza} ${p.tagline} ${p.gusto.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [categoriaAttiva, usoAttivo, query]);

  return (
    <div>
      <div className="mb-10 space-y-8">
        <div>
          <p className="mb-3 text-xs uppercase tracking-wide text-bark">Esplora per utilizzo</p>
          <div className="flex flex-wrap gap-2">
            {usoOptions.map((uso) => (
              <button
                key={uso}
                type="button"
                onClick={() => updateParam("uso", usoAttivo === uso ? null : uso)}
                aria-pressed={usoAttivo === uso}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  usoAttivo === uso
                    ? "border-ink bg-ink text-paper"
                    : "border-stone text-ink hover:border-ink"
                }`}
              >
                {uso.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-3 text-xs uppercase tracking-wide text-bark">Categoria</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateParam("categoria", null)}
                aria-pressed={!categoriaAttiva}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  !categoriaAttiva
                    ? "border-ink bg-ink text-paper"
                    : "border-stone text-ink hover:border-ink"
                }`}
              >
                Tutte
              </button>
              {categoriaOptions.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => updateParam("categoria", categoriaAttiva === cat ? null : cat)}
                  aria-pressed={categoriaAttiva === cat}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    categoriaAttiva === cat
                      ? "border-ink bg-ink text-paper"
                      : "border-stone text-ink hover:border-ink"
                  }`}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full max-w-xs">
            <label htmlFor="cerca-prodotto" className="mb-2 block text-xs uppercase tracking-wide text-bark">
              Cerca per gusto o nome
            </label>
            <input
              id="cerca-prodotto"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Es. intenso, limone, regalo…"
              className="w-full rounded-xl border border-stone bg-paper px-4 py-2.5 text-sm focus:border-olive-600"
            />
          </div>
        </div>
      </div>

      <p className="mb-6 text-sm text-bark">
        {filtered.length} {filtered.length === 1 ? "prodotto trovato" : "prodotti trovati"}
      </p>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-stone py-16 text-center">
          <p className="text-ink">Nessun olio corrisponde ai filtri selezionati.</p>
          <button
            type="button"
            onClick={() => {
              updateParam("categoria", null);
              updateParam("uso", null);
              setQuery("");
            }}
            className="mt-4 underline"
          >
            Azzera i filtri
          </button>
        </div>
      )}
    </div>
  );
}
