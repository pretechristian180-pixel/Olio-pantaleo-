import Link from "next/link";
import { Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Price } from "@/components/ui/price";

const vantaggi = [
  "Accesso illimitato, anche da telefono",
  "Materiali e modelli scaricabili",
  "Attestato di completamento",
  "Pagamento sicuro, anche a rate",
];

/** Card acquisto con trailer (mockup Corso). L'acquisto con Stripe si attiva in Fase 3. */
export function PurchaseCard({
  prezzoCents,
  valuta,
  courseHref,
  freeLessonHref,
  enrolled = false,
}: {
  prezzoCents: number;
  valuta: string;
  /** Dove porta "Vai al corso" quando l'utente è già iscritto. */
  courseHref?: string;
  freeLessonHref?: string | null;
  enrolled?: boolean;
}) {
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
        {enrolled && courseHref ? (
          <Button asChild size="lg" block>
            <Link href={courseHref}>Vai al corso</Link>
          </Button>
        ) : (
          <>
            <Button size="lg" block disabled>
              Acquista il corso
            </Button>
            {freeLessonHref ? (
              <Button asChild variant="secondary" block>
                <Link href={freeLessonHref}>Guarda una lezione gratis</Link>
              </Button>
            ) : (
              <Button variant="secondary" block disabled>
                Guarda una lezione gratis
              </Button>
            )}
            <p className="text-center text-xs text-ink-muted">
              L&apos;acquisto online si attiva a breve.
            </p>
          </>
        )}
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
