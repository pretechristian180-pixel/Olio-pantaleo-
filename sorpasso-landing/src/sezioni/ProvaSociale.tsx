import { provaSociale } from "@/contenuti";
import { Sezione } from "@/componenti/Sezione";

export function ProvaSociale() {
  const t = provaSociale.testimonianza;
  return (
    <Sezione id="caso-pilota" occhiello="Prova sociale" titolo={provaSociale.titolo}>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rivela overflow-hidden rounded-2xl border border-line bg-bg-2">
          <div className="relative aspect-video bg-[radial-gradient(circle_at_30%_30%,rgb(61_107_255/0.25),transparent_60%)]">
            {t.videoUrl ? (
              /\.mp4($|\?)/.test(t.videoUrl) ? (
                <video src={t.videoUrl} controls preload="none" className="size-full object-cover" />
              ) : (
                <iframe src={t.videoUrl} title={`Testimonianza di ${t.nome}`} className="size-full" loading="lazy" allow="fullscreen; picture-in-picture" />
              )
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 text-muted">
                <span className="flex size-16 items-center justify-center rounded-full border border-line-2 bg-surface">
                  <svg viewBox="0 0 24 24" className="ml-1 size-7 text-white" aria-hidden>
                    <path d="M7 5v14l12-7z" fill="currentColor" />
                  </svg>
                </span>
                <span className="text-sm">Video testimonianza [SEGNAPOSTO]</span>
              </div>
            )}
          </div>
          <blockquote className="p-6 sm:p-7">
            <p className="text-[19px] leading-relaxed">{t.citazione}</p>
            <footer className="mt-4 text-[15px] text-muted">
              <strong className="text-text">{t.nome}</strong> · {t.ruolo}
            </footer>
          </blockquote>
        </div>
        <ul className="grid gap-4">
          {provaSociale.numeri.map((n) => (
            <li key={n.etichetta} className="rivela flex flex-col justify-center rounded-2xl border border-line bg-bg-2 p-6">
              <span className="font-display text-[44px] font-extrabold leading-none text-white">{n.valore}</span>
              <span className="mt-2 text-muted">{n.etichetta}</span>
            </li>
          ))}
        </ul>
      </div>
    </Sezione>
  );
}
