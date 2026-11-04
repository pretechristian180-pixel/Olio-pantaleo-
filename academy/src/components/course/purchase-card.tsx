import { Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Price } from "@/components/ui/price";

const vantaggi = [
  "Accesso illimitato, anche da telefono",
  "Materiali e modelli scaricabili",
  "Attestato Nexora a fine corso",
  "Pagamento sicuro, anche a rate",
];

/** Card acquisto con trailer (mockup Corso). Pulsanti attivi da Fase 2 (anteprima) e Fase 3 (Stripe). */
export function PurchaseCard({ prezzoCents, valuta }: { prezzoCents: number; valuta: string }) {
  return (
    <div className="overflow-hidden rounded-lg bg-surface text-ink">
      <div className="flex aspect-[17/10] flex-col bg-graphite p-4">
        <Eyebrow as="span" className="text-[11px] text-white/80">
          Trailer del corso
        </Eyebrow>
        <span
          aria-hidden
          className="m-auto flex size-16 items-center justify-center rounded-full bg-nexora-blue text-white"
        >
          <Play className="size-5 fill-current" />
        </span>
      </div>
      <div className="flex flex-col gap-4 p-7">
        <p className="flex items-baseline gap-2.5">
          <Price cents={prezzoCents} currency={valuta} className="text-4xl" />
          <span className="text-[13px] text-ink-muted">IVA inclusa</span>
        </p>
        <Button size="lg" block disabled>
          Acquista il corso
        </Button>
        <Button variant="secondary" block disabled>
          Guarda una lezione gratis
        </Button>
        <p className="text-center text-xs text-ink-muted">
          Anteprima e acquisto si attivano nelle prossime fasi.
        </p>
        <ul className="flex flex-col gap-3 pt-1">
          {vantaggi.map((v) => (
            <li key={v} className="flex items-center gap-3 text-sm">
              <Check aria-hidden className="size-4 shrink-0 text-positive" />
              {v}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
