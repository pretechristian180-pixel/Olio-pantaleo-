import { useId, useState } from "react";
import { calcolatore } from "@/contenuti";
import { Sezione } from "@/componenti/Sezione";
import { LinkPulsante } from "@/componenti/Pulsante";
import { euro, numero } from "@/lib/rivela";

/**
 * Auto recuperate in un anno = lead/mese × 12 × conversione × aumento (20%).
 * Margine recuperato = auto recuperate × margine medio.
 */
export function Calcolatore() {
  const [lead, setLead] = useState(calcolatore.valoriIniziali.leadMese);
  const [conv, setConv] = useState(calcolatore.valoriIniziali.conversione);
  const [margine, setMargine] = useState(calcolatore.valoriIniziali.margineMedio);

  const autoAttuali = lead * 12 * (conv / 100);
  const autoInPiu = autoAttuali * calcolatore.aumentoConversione;
  const margineInPiu = autoInPiu * margine;
  const convNuova = conv * (1 + calcolatore.aumentoConversione);

  return (
    <Sezione id="calcolatore" occhiello="Il costo del problema" titolo={calcolatore.titolo} sottotitolo={calcolatore.sottotitolo}>
      <div className="rivela grid overflow-hidden rounded-3xl border border-line-2 bg-bg-2 lg:grid-cols-2">
        <div className="space-y-8 p-6 sm:p-10">
          <Cursore etichetta="Lead al mese" valore={lead} min={10} max={1000} passo={10} onChange={setLead} formato={(v) => numero(v)} />
          <Cursore
            etichetta="Tasso di conversione attuale"
            aiuto="Su 100 lead, quanti comprano"
            valore={conv}
            min={1}
            max={25}
            passo={0.5}
            onChange={setConv}
            formato={(v) => `${numero(v, 1)}%`}
          />
          <Cursore etichetta="Margine medio per auto" valore={margine} min={300} max={8000} passo={100} onChange={setMargine} formato={(v) => euro(v)} />
        </div>

        <div className="relative flex flex-col justify-center overflow-hidden bg-[radial-gradient(circle_at_70%_20%,rgb(61_107_255/0.35),transparent_60%)] p-6 sm:p-10 lg:border-l lg:border-line-2">
          <p className="text-[16px] font-medium text-muted">Margine in più in un anno</p>
          <p className="mt-2 font-display text-[52px] font-extrabold leading-none tracking-tight text-white tabular-nums sm:text-[72px]" aria-live="polite">
            {euro(margineInPiu)}
          </p>
          <p className="mt-4 text-[18px]">
            <strong className="text-white">{numero(autoInPiu, 0)} auto vendute in più</strong>{" "}
            <span className="text-muted">
              ({numero(autoAttuali, 0)} → {numero(autoAttuali + autoInPiu, 0)} all'anno, conversione dal {numero(conv, 1)}% al {numero(convNuova, 1)}%)
            </span>
          </p>
          <p className="mt-6 text-sm leading-relaxed text-muted">{calcolatore.nota}</p>
          <LinkPulsante href="#demo" className="mt-7 self-start">
            Rifacciamo il conto con i tuoi dati
          </LinkPulsante>
        </div>
      </div>
    </Sezione>
  );
}

function Cursore({
  etichetta,
  aiuto,
  valore,
  min,
  max,
  passo,
  onChange,
  formato,
}: {
  etichetta: string;
  aiuto?: string;
  valore: number;
  min: number;
  max: number;
  passo: number;
  onChange: (v: number) => void;
  formato: (v: number) => string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[16px] font-semibold">
          {etichetta}
          {aiuto && <span className="block text-sm font-normal text-muted">{aiuto}</span>}
        </label>
        <input
          type="number"
          inputMode="decimal"
          aria-label={`${etichetta}, valore`}
          className="w-28 rounded-lg border border-line-2 bg-surface px-3 py-2 text-right font-display text-[18px] font-bold tabular-nums focus-visible:border-accent focus-visible:outline-none"
          value={valore}
          min={min}
          max={max}
          step={passo}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(0, v)));
          }}
        />
      </div>
      <input
        id={id}
        type="range"
        className="mt-4 h-2 w-full cursor-pointer"
        min={min}
        max={max}
        step={passo}
        value={valore}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={formato(valore)}
      />
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{formato(min)}</span>
        <span>{formato(max)}</span>
      </div>
    </div>
  );
}
