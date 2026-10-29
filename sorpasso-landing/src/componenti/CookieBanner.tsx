import { useEffect, useState } from "react";
import { salvaConsenso, useConsenso } from "@/lib/consenso";
import { applicaConsenso } from "@/lib/tracciamento";

/**
 * Banner cookie: "Accetta tutti" e "Rifiuta" hanno lo stesso peso visivo (linee guida Garante).
 * Chiudere senza scegliere non vale come consenso.
 */
export function CookieBanner() {
  const { consenso, mostraBanner } = useConsenso();
  const [personalizza, setPersonalizza] = useState(false);
  const [stat, setStat] = useState(false);
  const [mkt, setMkt] = useState(false);

  useEffect(() => {
    if (mostraBanner) {
      setStat(consenso?.statistiche ?? false);
      setMkt(consenso?.marketing ?? false);
    }
  }, [mostraBanner, consenso]);

  useEffect(() => applicaConsenso(consenso), [consenso]);

  if (!mostraBanner) return null;

  const scegli = (s: boolean, m: boolean) => salvaConsenso({ statistiche: s, marketing: m });

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookie-titolo" className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-md">
      <div className="rounded-2xl border border-line-2 bg-bg-2 p-5 shadow-2xl">
        <h2 id="cookie-titolo" className="text-lg font-bold">
          Cookie e privacy
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Usiamo cookie tecnici necessari al funzionamento del sito e, solo con il tuo consenso, cookie statistici (Google
          Analytics) e di marketing (Meta). Puoi cambiare idea in qualsiasi momento.{" "}
          <a href="/cookie-policy" className="text-accent-2 underline underline-offset-2">
            Cookie policy
          </a>
        </p>

        {personalizza && (
          <fieldset className="mt-4 space-y-2.5">
            <legend className="sr-only">Categorie di cookie</legend>
            <Voce titolo="Necessari" testo="Servono al funzionamento del sito. Sempre attivi." attivo disabilitato />
            <Voce titolo="Statistiche" testo="Ci aiutano a capire come viene usato il sito (Google Analytics, dati aggregati)." attivo={stat} onChange={setStat} />
            <Voce titolo="Marketing" testo="Misurano l'efficacia delle nostre campagne (Meta Pixel)." attivo={mkt} onChange={setMkt} />
          </fieldset>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => scegli(false, false)} className="h-11 rounded-full border border-line-2 bg-surface text-[15px] font-semibold hover:bg-surface-hover">
            Rifiuta
          </button>
          <button type="button" onClick={() => scegli(true, true)} className="h-11 rounded-full border border-line-2 bg-surface text-[15px] font-semibold hover:bg-surface-hover">
            Accetta tutti
          </button>
          {personalizza ? (
            <button type="button" onClick={() => scegli(stat, mkt)} className="col-span-2 h-11 rounded-full bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover">
              Salva le mie scelte
            </button>
          ) : (
            <button type="button" onClick={() => setPersonalizza(true)} className="col-span-2 h-10 text-[15px] font-medium text-accent-2 underline-offset-2 hover:underline">
              Personalizza
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Voce({
  titolo,
  testo,
  attivo,
  disabilitato,
  onChange,
}: {
  titolo: string;
  testo: string;
  attivo: boolean;
  disabilitato?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 rounded-xl border border-line p-3 ${disabilitato ? "opacity-70" : "cursor-pointer"}`}>
      <span>
        <span className="block text-[15px] font-semibold">{titolo}</span>
        <span className="block text-sm text-muted">{testo}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="mt-1 size-5 shrink-0 accent-[var(--accent)]"
        checked={attivo}
        disabled={disabilitato}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </label>
  );
}
