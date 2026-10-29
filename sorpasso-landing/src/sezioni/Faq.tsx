import { useId, useState } from "react";
import { faq } from "@/contenuti";
import { Sezione } from "@/componenti/Sezione";

export function Faq() {
  return (
    <Sezione id="faq" occhiello="Obiezioni" titolo={faq.titolo}>
      <div className="mx-auto max-w-3xl divide-y divide-line rounded-2xl border border-line bg-bg-2">
        {faq.elenco.map((d, i) => (
          <Voce key={d.domanda} domanda={d.domanda} risposta={d.risposta} iniziale={i === 0} />
        ))}
      </div>
    </Sezione>
  );
}

function Voce({ domanda, risposta, iniziale }: { domanda: string; risposta: string; iniziale?: boolean }) {
  const [aperta, setAperta] = useState(!!iniziale);
  const id = useId();
  return (
    <div className="rivela">
      <h3>
        <button
          type="button"
          aria-expanded={aperta}
          aria-controls={id}
          onClick={() => setAperta((a) => !a)}
          className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-[18px] font-bold sm:px-7"
        >
          {domanda}
          <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-full border border-line-2 text-accent-2 transition-transform ${aperta ? "rotate-45" : ""}`}>
            +
          </span>
        </button>
      </h3>
      <div id={id} role="region" hidden={!aperta} className="px-5 pb-6 text-[17px] leading-relaxed text-muted sm:px-7">
        {risposta}
      </div>
    </div>
  );
}
