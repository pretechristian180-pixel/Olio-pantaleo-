import { funzionalita, perChi } from "@/contenuti";
import { Sezione } from "@/componenti/Sezione";

export function Funzionalita() {
  return (
    <Sezione id="funzionalita" occhiello="Funzionalità" titolo={funzionalita.titolo} sottotitolo={funzionalita.sottotitolo}>
      <ul className="grid gap-x-10 gap-y-2 md:grid-cols-2">
        {funzionalita.elenco.map((f) => (
          <li key={f.titolo} className="rivela flex gap-4 border-b border-line py-5">
            <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-2">
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                <path d="m5 10 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <h3 className="text-[19px] font-bold">{f.titolo}</h3>
              <p className="mt-1 text-muted">{f.beneficio}</p>
            </div>
          </li>
        ))}
      </ul>
    </Sezione>
  );
}

export function PerChi() {
  return (
    <Sezione id="per-chi" occhiello="Per chi è" titolo={perChi.titolo} className="!pt-4">
      <div className="grid gap-4 md:grid-cols-3">
        {perChi.elenco.map((p) => (
          <article key={p.titolo} className="rivela rounded-2xl border border-line bg-gradient-to-b from-bg-3 to-bg-2 p-6 sm:p-7">
            <h3 className="text-[20px] font-bold">{p.titolo}</h3>
            <p className="mt-2 text-muted">{p.testo}</p>
          </article>
        ))}
      </div>
    </Sezione>
  );
}
