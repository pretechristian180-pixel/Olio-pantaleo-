"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getAccount, setAccount, clearAccount, type Account } from "@/lib/account";
import { getOrders, type Order } from "@/lib/orders";
import { formatEUR } from "@/lib/data/products";

export function AccountPanel() {
  const [account, setAccountState] = useState<Account | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({ nome: "", email: "" });

  useEffect(() => {
    // Legge da localStorage dopo il mount per evitare un mismatch di idratazione
    // rispetto al markup renderizzato lato server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccountState(getAccount());
    setOrders(getOrders());
  }, []);

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAccount(form);
    setAccountState(form);
  }

  function handleLogout() {
    clearAccount();
    setAccountState(null);
  }

  if (account === undefined) {
    return <div className="min-h-[40vh]" />;
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="font-serif text-3xl text-ink">Il tuo account</h1>
        <p className="mt-2 text-sm text-bark">
          Accedi per vedere lo storico dei tuoi ordini Pantaleo.
        </p>
        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <div>
            <label htmlFor="acc-nome" className="mb-1.5 block text-sm text-bark">
              Nome
            </label>
            <input
              id="acc-nome"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full rounded-xl border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
            />
          </div>
          <div>
            <label htmlFor="acc-email" className="mb-1.5 block text-sm text-bark">
              Email
            </label>
            <input
              id="acc-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
            />
          </div>
          <button type="submit" className="w-full rounded-full bg-ink py-3.5 text-sm tracking-wide text-paper transition-colors hover:bg-olive-800">
            Accedi
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">Ciao, {account.nome.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-bark">{account.email}</p>
        </div>
        <button type="button" onClick={handleLogout} className="text-sm underline underline-offset-4">
          Esci
        </button>
      </div>

      <h2 className="mt-10 font-serif text-xl text-ink">I tuoi ordini</h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-sm text-bark">
          Non hai ancora ordini. <Link href="/prodotti" className="underline">Scopri i nostri oli</Link>.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-sand rounded-3xl border border-sand px-5 shadow-soft">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between py-4 text-sm">
              <div>
                <p className="text-ink">{order.id}</p>
                <p className="text-bark">{new Date(order.data).toLocaleDateString("it-IT")}</p>
              </div>
              <p className="text-ink">{formatEUR(order.totale)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
