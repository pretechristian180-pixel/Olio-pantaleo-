import type { ReactNode } from "react";
import { useEffect } from "react";

export function PaginaLegale({ titolo, aggiornata, children }: { titolo: string; aggiornata: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${titolo} — Sorpasso AI`;
  }, [titolo]);
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-28 sm:px-8 sm:pt-36">
      <a href="/" className="text-[15px] text-accent-2 hover:underline">
        ← Torna alla home
      </a>
      <h1 className="mt-6 text-[36px] font-extrabold sm:text-[44px]">{titolo}</h1>
      <p className="mt-2 text-muted">Ultimo aggiornamento: {aggiornata}</p>
      <div className="mt-6 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-[15px] text-warn">
        Testo di base da far verificare a un consulente privacy prima della pubblicazione. I dati tra parentesi quadre sono
        segnaposto.
      </div>
      <div className="testo-legale mt-10 space-y-6 text-[17px] leading-relaxed text-muted [&_h2]:mt-10 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-text [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-text [&_a]:text-accent-2 [&_a]:underline">
        {children}
      </div>
    </main>
  );
}
