"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatEUR } from "@/lib/data/products";
import { saveOrder, generateOrderId } from "@/lib/orders";
import { track } from "@/lib/analytics";

export default function CheckoutPage() {
  const { items, hydrated, totale, svuota } = useCart();
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    indirizzo: "",
    citta: "",
    cap: "",
    pagamento: "carta",
  });

  useEffect(() => {
    if (hydrated && items.length > 0) {
      track({ name: "begin_checkout", params: { valore: totale, articoli: items.length } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (hydrated && items.length === 0) {
    return (
      <section className="container-editorial flex min-h-[50vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-serif text-3xl text-ink">Non hai prodotti nel carrello</h1>
        <Link
          href="/prodotti"
          className="mt-8 inline-flex bg-ink px-7 py-3.5 text-sm tracking-wide text-paper hover:bg-olive-800"
        >
          Vai ai prodotti
        </Link>
      </section>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const id = generateOrderId();
    saveOrder({
      id,
      data: new Date().toISOString(),
      items,
      totale,
      spedizione: {
        nome: form.nome,
        indirizzo: form.indirizzo,
        citta: form.citta,
        cap: form.cap,
        email: form.email,
      },
    });
    track({ name: "purchase", params: { ordineId: id, valore: totale, articoli: items.length } });
    svuota();
    router.push(`/checkout/conferma?ordine=${id}`);
  }

  return (
    <section className="container-editorial py-16">
      <h1 className="font-serif text-3xl text-ink sm:text-4xl">Checkout</h1>

      <div className="mt-10 grid gap-14 lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <h2 className="font-serif text-xl text-ink">Spedizione</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="nome" className="mb-1.5 block text-sm text-bark">
                  Nome e cognome
                </label>
                <input
                  id="nome"
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="email" className="mb-1.5 block text-sm text-bark">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="indirizzo" className="mb-1.5 block text-sm text-bark">
                  Indirizzo
                </label>
                <input
                  id="indirizzo"
                  required
                  value={form.indirizzo}
                  onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
                  className="w-full border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
                />
              </div>
              <div>
                <label htmlFor="citta" className="mb-1.5 block text-sm text-bark">
                  Città
                </label>
                <input
                  id="citta"
                  required
                  value={form.citta}
                  onChange={(e) => setForm({ ...form, citta: e.target.value })}
                  className="w-full border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
                />
              </div>
              <div>
                <label htmlFor="cap" className="mb-1.5 block text-sm text-bark">
                  CAP
                </label>
                <input
                  id="cap"
                  required
                  value={form.cap}
                  onChange={(e) => setForm({ ...form, cap: e.target.value })}
                  className="w-full border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-serif text-xl text-ink">Pagamento</h2>
            <div className="mt-4 space-y-2">
              {[
                { id: "carta", label: "Carta di credito o debito" },
                { id: "paypal", label: "PayPal" },
                { id: "bonifico", label: "Bonifico bancario anticipato" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-3 border border-stone px-4 py-3 text-sm has-[:checked]:border-ink"
                >
                  <input
                    type="radio"
                    name="pagamento"
                    value={opt.id}
                    checked={form.pagamento === opt.id}
                    onChange={(e) => setForm({ ...form, pagamento: e.target.value })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-ink py-4 text-sm tracking-wide text-paper hover:bg-olive-800"
          >
            Conferma e paga {formatEUR(totale)}
          </button>
        </form>

        <aside className="h-fit border border-sand p-6">
          <h2 className="font-serif text-xl text-ink">Il tuo ordine</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {items.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-2">
                <span className="text-bark">
                  {item.nome} ({item.formato}) × {item.quantita}
                </span>
                <span className="text-ink">{formatEUR(item.prezzo * item.quantita)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-sand pt-4 text-base">
            <span className="text-ink">Totale</span>
            <span className="font-serif text-xl text-ink">{formatEUR(totale)}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
