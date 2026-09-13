"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getOrder, type Order } from "@/lib/orders";
import { formatEUR } from "@/lib/data/products";

export function OrderConfirmation() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("ordine");
  const [order, setOrder] = useState<Order | null | undefined>(undefined);

  useEffect(() => {
    // Legge da localStorage dopo il mount per evitare un mismatch di idratazione.
    if (!orderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrder(null);
      return;
    }
    setOrder(getOrder(orderId) ?? null);
  }, [orderId]);

  if (order === undefined) {
    return <div className="container-editorial py-24" />;
  }

  if (!order) {
    return (
      <section className="container-editorial flex min-h-[50vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-serif text-3xl text-ink">Ordine non trovato</h1>
        <Link href="/" className="mt-6 underline">
          Torna alla home
        </Link>
      </section>
    );
  }

  return (
    <section className="container-editorial flex min-h-[70vh] flex-col items-center py-24 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-clay-600">Grazie</p>
      <h1 className="mt-4 font-serif text-4xl text-ink sm:text-5xl">Il tuo ordine è confermato.</h1>
      <p className="mt-4 text-bark">
        Numero ordine <span className="font-medium text-ink">{order.id}</span>. Riceverai un
        aggiornamento all&apos;indirizzo {order.spedizione.email}.
      </p>

      <div className="mt-10 w-full max-w-md border border-sand p-6 text-left">
        <ul className="space-y-3 text-sm">
          {order.items.map((item) => (
            <li key={item.variantId} className="flex justify-between gap-2">
              <span className="text-bark">
                {item.nome} ({item.formato}) × {item.quantita}
              </span>
              <span className="text-ink">{formatEUR(item.prezzo * item.quantita)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-sand pt-4">
          <span className="text-ink">Totale</span>
          <span className="font-serif text-xl text-ink">{formatEUR(order.totale)}</span>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link href="/prodotti" className="bg-ink px-7 py-3.5 text-sm tracking-wide text-paper hover:bg-olive-800">
          Continua lo shopping
        </Link>
        <Link href="/account" className="border border-ink px-7 py-3.5 text-sm tracking-wide text-ink hover:bg-ink hover:text-paper">
          Vai al tuo account
        </Link>
      </div>
    </section>
  );
}
