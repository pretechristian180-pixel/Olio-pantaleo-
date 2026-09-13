"use client";

import { useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";

export function B2BContactForm() {
  const [sent, setSent] = useState(false);
  const [azienda, setAzienda] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    track({ name: "contact_b2b", params: { azienda } });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="border border-olive-300 bg-olive-50 p-8 text-center">
        <p className="font-serif text-xl text-olive-800">Richiesta ricevuta.</p>
        <p className="mt-2 text-sm text-bark">
          Il team Pantaleo dedicato alle aziende ti risponderà al più presto per approfondire la
          tua richiesta.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-1">
        <label htmlFor="b2b-nome" className="mb-1.5 block text-sm text-bark">
          Nome e cognome
        </label>
        <input
          id="b2b-nome"
          required
          type="text"
          className="w-full border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
        />
      </div>
      <div className="sm:col-span-1">
        <label htmlFor="b2b-azienda" className="mb-1.5 block text-sm text-bark">
          Azienda
        </label>
        <input
          id="b2b-azienda"
          required
          type="text"
          value={azienda}
          onChange={(e) => setAzienda(e.target.value)}
          className="w-full border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
        />
      </div>
      <div className="sm:col-span-1">
        <label htmlFor="b2b-email" className="mb-1.5 block text-sm text-bark">
          Email
        </label>
        <input
          id="b2b-email"
          required
          type="email"
          className="w-full border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
        />
      </div>
      <div className="sm:col-span-1">
        <label htmlFor="b2b-ruolo" className="mb-1.5 block text-sm text-bark">
          Sei un…
        </label>
        <select
          id="b2b-ruolo"
          required
          className="w-full border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
        >
          <option value="">Seleziona</option>
          <option>Buyer / distributore</option>
          <option>Azienda per private label</option>
          <option>Operatore Horeca</option>
          <option>Altro</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="b2b-messaggio" className="mb-1.5 block text-sm text-bark">
          Raccontaci il tuo progetto
        </label>
        <textarea
          id="b2b-messaggio"
          rows={4}
          className="w-full border border-stone bg-paper px-4 py-3 text-sm focus:border-olive-600"
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="bg-ink px-8 py-3.5 text-sm tracking-wide text-paper hover:bg-olive-800"
        >
          PARLA CON PANTALEO
        </button>
      </div>
    </form>
  );
}
