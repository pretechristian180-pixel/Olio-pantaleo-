import { problemi } from "@/contenuti";
import { Sezione } from "@/componenti/Sezione";

const ICONE = [
  // lead sparsi
  <path key="a" d="M4 6h7M4 12h10M4 18h6M17 5l3 3-3 3M14 16h6" />,
  // orologio
  <g key="b"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></g>,
  // auto ferma
  <g key="c"><path d="M4 15v-3l2-4h12l2 4v3z" /><circle cx="8" cy="16" r="1.6" /><circle cx="16" cy="16" r="1.6" /></g>,
  // grafico
  <path key="d" d="M5 19V9M12 19V5M19 19v-7" />,
];

export function Problema() {
  return (
    <Sezione id="problema" occhiello="Il problema" titolo={problemi.titolo} sottotitolo={problemi.sottotitolo}>
      <div className="grid gap-4 sm:grid-cols-2">
        {problemi.card.map((c, i) => (
          <article
            key={c.titolo}
            className="rivela rounded-2xl border border-line bg-bg-2 p-6 transition-colors hover:border-line-2 sm:p-7"
            style={{ transitionDelay: `${i * 70}ms` }}
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-danger/12 text-danger">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {ICONE[i]}
              </svg>
            </span>
            <h3 className="mt-5 text-[21px] font-bold">{c.titolo}</h3>
            <p className="mt-2 text-muted">{c.testo}</p>
          </article>
        ))}
      </div>
    </Sezione>
  );
}
