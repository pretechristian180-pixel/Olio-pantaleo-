"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatEUR, type Product } from "@/lib/data/products";

export function ProductPurchasePanel({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.formati[0].id);
  const [quantita, setQuantita] = useState(1);
  const [feedback, setFeedback] = useState(false);
  const { aggiungi } = useCart();

  const variant = product.formati.find((f) => f.id === variantId) ?? product.formati[0];

  function handleAdd() {
    aggiungi(
      {
        variantId: variant.id,
        slug: product.slug,
        nome: product.nome,
        formato: variant.formato,
        prezzo: variant.prezzo,
        accent: product.accent,
      },
      quantita,
    );
    setFeedback(true);
    window.setTimeout(() => setFeedback(false), 2600);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm text-bark">Formato</p>
        <div className="flex flex-wrap gap-2">
          {product.formati.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setVariantId(f.id)}
              aria-pressed={variantId === f.id}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                variantId === f.id
                  ? "border-ink bg-ink text-paper"
                  : "border-stone text-ink hover:border-ink"
              }`}
            >
              {f.formato}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm text-bark">Prezzo</p>
          <p className="font-serif text-3xl text-ink">{formatEUR(variant.prezzo)}</p>
        </div>

        <div className="flex items-center rounded-full border border-stone">
          <button
            type="button"
            onClick={() => setQuantita((q) => Math.max(1, q - 1))}
            className="px-3.5 py-2 text-lg"
            aria-label="Diminuisci quantità"
          >
            −
          </button>
          <span className="w-8 text-center text-sm" aria-live="polite">
            {quantita}
          </span>
          <button
            type="button"
            onClick={() => setQuantita((q) => Math.min(20, q + 1))}
            className="px-3.5 py-2 text-lg"
            aria-label="Aumenta quantità"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={!variant.disponibile}
        className="w-full rounded-full bg-clay-500 py-4 text-sm tracking-wide text-paper shadow-soft transition-all hover:-translate-y-0.5 hover:bg-clay-600 hover:shadow-soft-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-stone disabled:shadow-none"
      >
        {variant.disponibile ? "Aggiungi al carrello" : "Non disponibile"}
      </button>

      <div aria-live="polite">
        {feedback && (
          <p className="rounded-2xl border border-olive-300 bg-olive-50 px-4 py-3 text-sm text-olive-800">
            Aggiunto al carrello.{" "}
            <Link href="/carrello" className="underline">
              Vai al carrello
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
