"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatEUR } from "@/lib/data/products";
import { BottleGlyph } from "@/components/illustrations/BottleGlyph";
import { accentBg } from "@/lib/accent";

export default function CarrelloPage() {
  const { items, hydrated, totale, rimuovi, aggiornaQuantita } = useCart();

  if (!hydrated) {
    return <div className="container-editorial py-24" />;
  }

  if (items.length === 0) {
    return (
      <section className="container-editorial flex min-h-[50vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-serif text-3xl text-ink">Il tuo carrello è vuoto</h1>
        <p className="mt-3 text-bark">Scopri la gamma Pantaleo e trova l&apos;olio giusto per te.</p>
        <Link
          href="/prodotti"
          className="mt-8 inline-flex bg-ink px-7 py-3.5 text-sm tracking-wide text-paper hover:bg-olive-800"
        >
          Continua lo shopping
        </Link>
      </section>
    );
  }

  return (
    <section className="container-editorial py-16">
      <h1 className="font-serif text-3xl text-ink sm:text-4xl">Il tuo carrello</h1>

      <div className="mt-10 grid gap-14 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-sand border-y border-sand">
          {items.map((item) => (
            <li key={item.variantId} className="flex gap-5 py-6">
              <div className={`flex h-24 w-24 shrink-0 items-center justify-center ${accentBg[item.accent]}`}>
                <BottleGlyph accent={item.accent} className="h-4/5" />
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div className="flex justify-between gap-4">
                  <div>
                    <Link href={`/prodotti/${item.slug}`} className="font-serif text-lg text-ink hover:text-olive-700">
                      {item.nome}
                    </Link>
                    <p className="text-sm text-bark">{item.formato}</p>
                  </div>
                  <p className="text-sm text-ink">{formatEUR(item.prezzo * item.quantita)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center border border-stone">
                    <button
                      type="button"
                      onClick={() => aggiornaQuantita(item.variantId, item.quantita - 1)}
                      className="px-3 py-1.5 text-lg"
                      aria-label={`Diminuisci quantità di ${item.nome}`}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm">{item.quantita}</span>
                    <button
                      type="button"
                      onClick={() => aggiornaQuantita(item.variantId, item.quantita + 1)}
                      className="px-3 py-1.5 text-lg"
                      aria-label={`Aumenta quantità di ${item.nome}`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => rimuovi(item.variantId)}
                    className="text-sm text-bark underline underline-offset-4 hover:text-danger"
                  >
                    Rimuovi
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit border border-sand p-6">
          <h2 className="font-serif text-xl text-ink">Riepilogo</h2>
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-bark">Subtotale</span>
            <span className="text-ink">{formatEUR(totale)}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-bark">Spedizione</span>
            <span className="text-ink">Calcolata al checkout</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-sand pt-4 text-base">
            <span className="text-ink">Totale</span>
            <span className="font-serif text-xl text-ink">{formatEUR(totale)}</span>
          </div>
          <Link
            href="/checkout"
            className="mt-6 block w-full bg-clay-500 py-3.5 text-center text-sm tracking-wide text-paper hover:bg-clay-600"
          >
            Procedi al checkout
          </Link>
          <Link
            href="/prodotti"
            className="mt-3 block w-full border border-stone py-3.5 text-center text-sm text-ink hover:border-ink"
          >
            Continua lo shopping
          </Link>
        </aside>
      </div>
    </section>
  );
}
