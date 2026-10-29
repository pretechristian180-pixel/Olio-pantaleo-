import { passaggi } from "@/contenuti";
import { Sezione } from "@/componenti/Sezione";

const ILLUSTRAZIONI = [
  // fonti che confluiscono in un elenco
  <svg key="1" viewBox="0 0 120 72" className="h-16 w-28" aria-hidden>
    {["AS", "SB", "FB", "WEB"].map((t, i) => (
      <g key={t}>
        <rect x="2" y={2 + i * 17} width="26" height="13" rx="4" fill="rgb(255 255 255 / .07)" stroke="rgb(255 255 255 / .18)" />
        <text x="15" y={11.5 + i * 17} textAnchor="middle" fontSize="7" fill="#9ca8c9" fontFamily="Inter">{t}</text>
        <path d={`M30 ${8.5 + i * 17} C 52 ${8.5 + i * 17}, 52 36, 72 36`} fill="none" stroke="#3d6bff" strokeOpacity=".7" strokeWidth="1.5" />
      </g>
    ))}
    <rect x="72" y="18" width="46" height="36" rx="7" fill="#3d6bff" />
    {[26, 34, 42].map((y) => <rect key={y} x="79" y={y} width="32" height="4" rx="2" fill="#fff" fillOpacity=".85" />)}
  </svg>,
  // chat + calendario
  <svg key="2" viewBox="0 0 120 72" className="h-16 w-28" aria-hidden>
    <rect x="4" y="8" width="58" height="20" rx="8" fill="rgb(255 255 255 / .08)" />
    <rect x="30" y="32" width="58" height="22" rx="8" fill="#005c4b" />
    <text x="59" y="46" textAnchor="middle" fontSize="7.5" fill="#fff" fontFamily="Inter">Sabato 10:30?</text>
    <rect x="86" y="16" width="30" height="30" rx="6" fill="#0b1530" stroke="#3d6bff" />
    <rect x="86" y="16" width="30" height="8" rx="4" fill="#3d6bff" />
    <path d="m94 35 4 4 8-8" fill="none" stroke="#3d6bff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  // dashboard
  <svg key="3" viewBox="0 0 120 72" className="h-16 w-28" aria-hidden>
    <rect x="6" y="6" width="108" height="60" rx="8" fill="rgb(255 255 255 / .06)" stroke="rgb(255 255 255 / .16)" />
    <rect x="14" y="40" width="10" height="18" rx="2" fill="#3d6bff" fillOpacity=".5" />
    <rect x="28" y="30" width="10" height="28" rx="2" fill="#3d6bff" fillOpacity=".75" />
    <rect x="42" y="20" width="10" height="38" rx="2" fill="#3d6bff" />
    <rect x="62" y="16" width="44" height="8" rx="3" fill="rgb(255 255 255 / .14)" />
    <rect x="62" y="30" width="34" height="6" rx="3" fill="rgb(255 255 255 / .1)" />
    <rect x="62" y="42" width="40" height="6" rx="3" fill="#f87171" fillOpacity=".55" />
  </svg>,
];

export function ComeFunziona() {
  return (
    <Sezione id="come-funziona" occhiello="Come funziona" titolo={passaggi.titolo} sottotitolo={passaggi.sottotitolo}>
      <ol className="grid gap-4 lg:grid-cols-3">
        {passaggi.elenco.map((p, i) => (
          <li key={p.titolo} className="rivela relative rounded-2xl border border-line bg-bg-2 p-6 sm:p-7" style={{ transitionDelay: `${i * 90}ms` }}>
            <div className="flex items-center justify-between">
              <span className="font-display text-[44px] font-extrabold leading-none text-accent-2/90">{i + 1}</span>
              {ILLUSTRAZIONI[i]}
            </div>
            <h3 className="mt-6 text-[22px] font-bold">{p.titolo}</h3>
            <p className="mt-2 text-muted">{p.testo}</p>
            {i < passaggi.elenco.length - 1 && (
              <span aria-hidden className="absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border border-line-2 bg-surface text-accent-2 lg:flex">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </Sezione>
  );
}
