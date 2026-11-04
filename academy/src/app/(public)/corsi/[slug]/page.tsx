import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Clock, Layers, PlayCircle } from "lucide-react";
import { getCourseBySlug } from "@/lib/data/courses";
import { formatDuration, formatPrice, pluralize } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await getCourseBySlug((await params).slug);
  if (!course) return { title: "Corso non trovato" };
  return {
    title: course.titolo,
    description: course.sottotitolo ?? undefined,
    alternates: { canonical: `/corsi/${course.slug}` },
    openGraph: {
      title: course.titolo,
      description: course.sottotitolo ?? undefined,
      type: "website",
    },
  };
}

// Fase 1: struttura essenziale. Card acquisto, trailer, fisarmonica e scheda docente arrivano in Fase 2.
export default async function CoursePage({ params }: Props) {
  const course = await getCourseBySlug((await params).slug);
  if (!course) notFound();
  const { outline } = course;

  return (
    <>
      <section className="bg-graphite-deep text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_360px] lg:py-20">
          <div>
            <Eyebrow tone="bright">Corso</Eyebrow>
            <h1 className="mt-4 text-3xl leading-tight font-bold sm:text-4xl">{course.titolo}</h1>
            {course.sottotitolo && (
              <p className="mt-4 max-w-2xl text-lg text-white/80">{course.sottotitolo}</p>
            )}
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
              <li className="inline-flex items-center gap-2">
                <Layers aria-hidden className="size-4" />{" "}
                {pluralize(outline.moduli.length, "modulo", "moduli")}
              </li>
              <li className="inline-flex items-center gap-2">
                <PlayCircle aria-hidden className="size-4" />{" "}
                {pluralize(outline.totaleLezioni, "lezione", "lezioni")}
              </li>
              <li className="inline-flex items-center gap-2">
                <Clock aria-hidden className="size-4" /> {formatDuration(outline.totaleDurataSec)}
              </li>
            </ul>
            {course.docente && (
              <p className="mt-6 text-sm text-white/70">
                Con <span className="font-semibold text-white">{course.docente.nome}</span>
                {course.docente.qualifica && `, ${course.docente.qualifica}`}
              </p>
            )}
          </div>
          <Card className="self-start text-ink">
            <CardBody>
              <p className="font-display text-3xl">
                {formatPrice(course.prezzo_cents, course.valuta)}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Pagamento unico, accesso senza scadenza.
              </p>
              <Button block size="lg" className="mt-6" disabled>
                Acquista il corso
              </Button>
              <p className="mt-3 text-center text-xs text-ink-muted">
                Acquisto attivo dalla Fase 3.
              </p>
            </CardBody>
          </Card>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-12">
          {course.risultati.length > 0 && (
            <section aria-labelledby="risultati">
              <h2 id="risultati" className="text-2xl font-bold">
                Cosa porti a casa
              </h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {course.risultati.map((r) => (
                  <li key={r} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
                    <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-nexora-blue" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="programma">
            <h2 id="programma" className="text-2xl font-bold">
              Programma
            </h2>
            <ol className="mt-6 space-y-4">
              {outline.moduli.map((m) => (
                <li key={m.id} className="rounded-lg border border-line bg-surface">
                  <div className="flex items-baseline justify-between gap-4 border-b border-line p-5">
                    <div>
                      <Eyebrow tone="muted">Modulo {m.numero}</Eyebrow>
                      <h3 className="mt-1 font-semibold">{m.titolo}</h3>
                    </div>
                    <span className="shrink-0 text-sm text-ink-muted">
                      {formatDuration(m.durataSec)}
                    </span>
                  </div>
                  <ul>
                    {m.lezioni.map((l) => (
                      <li key={l.id} className="flex min-h-12 items-center gap-3 px-5 py-2 text-sm">
                        <PlayCircle aria-hidden className="size-4 shrink-0 text-ink-muted" />
                        <span className="flex-1">{l.titolo}</span>
                        {l.isFreePreview && <Badge>Gratis</Badge>}
                        <span className="w-14 text-right text-ink-muted tabular-nums">
                          {formatDuration(l.durataSec)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
