"use client";

import { useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";

export function Newsletter({ origine }: { origine: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) {
      setStatus("error");
      return;
    }
    track({ name: "newsletter_signup", params: { origine } });
    setStatus("done");
    setEmail("");
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="font-serif text-xl text-ink">Le storie di Pantaleo, ogni mese</h3>
        <p className="mt-1 text-sm text-bark">
          Ricette, cultura dell&apos;olio e novità dal frantoio. Niente spam.
        </p>
      </div>
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="flex gap-2" noValidate>
          <label htmlFor={`newsletter-${origine}`} className="sr-only">
            Indirizzo email
          </label>
          <input
            id={`newsletter-${origine}`}
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setStatus("idle");
            }}
            placeholder="La tua email"
            className="w-full rounded-full border border-stone bg-paper px-5 py-3 text-sm text-ink placeholder:text-bark/60 focus:border-olive-600"
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-full bg-ink px-5 py-3 text-sm tracking-wide text-paper transition-colors hover:bg-olive-800"
          >
            Iscriviti
          </button>
        </form>
        {status === "done" && (
          <p role="status" className="mt-2 text-sm text-olive-700">
            Grazie, controlla la tua casella per confermare l&apos;iscrizione.
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="mt-2 text-sm text-danger">
            Inserisci un indirizzo email valido.
          </p>
        )}
      </div>
    </div>
  );
}
