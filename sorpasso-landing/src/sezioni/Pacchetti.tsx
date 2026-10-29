import { pacchetti } from "@/contenuti";
import { Sezione } from "@/componenti/Sezione";
import { LinkPulsante } from "@/componenti/Pulsante";

export function Pacchetti() {
  return (
    <Sezione id="pacchetti" occhiello="Pacchetti" titolo={pacchetti.titolo} sottotitolo={pacchetti.sottotitolo}>
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        {pacchetti.elenco.map((p) => (
          <article
            key={p.nome}
            className={`rivela relative flex flex-col rounded-3xl border p-7 ${
              p.evidenziato
                ? "border-accent bg-[linear-gradient(180deg,rgb(61_107_255/0.18),var(--bg-2)_45%)] shadow-[0_20px_60px_-20px_rgb(61_107_255/0.55)] lg:-my-4 lg:py-11"
                : "border-line bg-bg-2"
            }`}
          >
            {p.evidenziato && (
              <span className="absolute -top-3.5 left-7 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                Il più scelto
              </span>
            )}
            <h3 className="text-[22px] font-extrabold">{p.nome}</h3>
            <p className="mt-1 text-[15px] text-muted">{p.perChi}</p>
            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="font-display text-[40px] font-extrabold leading-none">{p.prezzo}</span>
              <span className="text-[15px] text-muted">{p.periodo}</span>
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {p.voci.map((v) => (
                <li key={v} className="flex gap-2.5 text-[16px]">
                  <svg viewBox="0 0 20 20" className="mt-1 size-4 shrink-0 text-accent-2" aria-hidden>
                    <path d="m5 10 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {v}
                </li>
              ))}
            </ul>
            <LinkPulsante href="#demo" variante={p.evidenziato ? "primario" : "secondario"} className="mt-8 w-full">
              Prenota la demo
            </LinkPulsante>
          </article>
        ))}
      </div>
      <div className="rivela mt-10 flex flex-col items-center gap-1 text-center">
        <p className="text-[19px] font-bold">✓ {pacchetti.nota}</p>
        <p className="max-w-2xl text-muted">{pacchetti.notaDettaglio}</p>
      </div>
    </Sezione>
  );
}
