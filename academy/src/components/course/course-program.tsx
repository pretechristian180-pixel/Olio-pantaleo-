import { ChevronDown, PlayCircle } from "lucide-react";
import type { Outline } from "@/lib/course-outline";
import { formatTimestamp, pluralize } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";

/** Programma a fisarmonica: il primo modulo è aperto. Funziona senza JavaScript. */
export function CourseProgram({ outline }: { outline: Outline }) {
  return (
    <section aria-labelledby="programma">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="programma" className="text-[22px] font-semibold">
          Programma del corso
        </h2>
        <p className="text-[13px] text-ink-muted">
          {pluralize(outline.moduli.length, "modulo", "moduli")} ·{" "}
          {pluralize(outline.totaleLezioni, "lezione", "lezioni")}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {outline.moduli.map((m, i) => (
          <details key={m.id} open={i === 0} className="group border-b border-line last:border-0">
            <summary className="flex min-h-19 cursor-pointer list-none items-center gap-4 px-6 py-4 group-open:bg-surface-alt [&::-webkit-details-marker]:hidden">
              <div className="flex-1">
                <Eyebrow className="text-[11px] group-open:text-nexora-blue-bright" tone="muted">
                  Modulo {m.numero}
                </Eyebrow>
                <h3 className="mt-1 font-semibold">{m.titolo}</h3>
              </div>
              <ChevronDown
                aria-hidden
                className="size-5 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <ul>
              {m.lezioni.map((l) => (
                <li
                  key={l.id}
                  className="flex min-h-13 items-center gap-3 border-t border-line px-6 py-3 text-sm"
                >
                  <PlayCircle aria-hidden className="size-4.5 shrink-0 text-ink-muted" />
                  <span className="flex-1">{l.titolo}</span>
                  {l.isFreePreview && <Badge>Gratis</Badge>}
                  <span className="w-12 text-right text-[13px] text-ink-muted tabular-nums">
                    <span className="sr-only">Durata </span>
                    {formatTimestamp(l.durataSec)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
