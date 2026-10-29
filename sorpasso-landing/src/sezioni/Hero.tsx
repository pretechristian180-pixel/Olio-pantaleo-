import { hero } from "@/contenuti";
import { LinkPulsante } from "@/componenti/Pulsante";
import { Mockup } from "./Mockup";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      {/* Bagliore elettrico di sfondo */}
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-20%] h-[640px] w-[640px] rounded-full bg-accent/25 blur-[140px]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,var(--bg)_92%),repeating-linear-gradient(90deg,rgb(255_255_255/0.025)_0_1px,transparent_1px_80px)]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="rivela mb-5 inline-flex items-center gap-2 rounded-full border border-line-2 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-muted">
            <span className="size-2 rounded-full bg-ok" aria-hidden />
            {hero.occhiello}
          </p>
          <h1 className="rivela text-[38px] font-extrabold leading-[1.06] sm:text-[54px] lg:text-[52px] xl:text-[58px]">{hero.titolo}</h1>
          <p className="rivela mt-6 max-w-xl text-[19px] leading-relaxed text-muted sm:text-[21px]">{hero.sottotitolo}</p>
          <div className="rivela mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            <LinkPulsante href="#demo" misura="lg">
              {hero.cta}
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                <path d="M4 10h11m-4-4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </LinkPulsante>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-muted">
              {hero.rassicurazioni.map((r) => (
                <li key={r} className="flex items-center gap-1.5">
                  <svg viewBox="0 0 20 20" className="size-4 text-ok" aria-hidden>
                    <path d="m5 10 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="rivela">
          <Mockup />
        </div>
      </div>
    </section>
  );
}
