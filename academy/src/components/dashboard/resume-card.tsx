import Link from "next/link";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatTimestamp, percent } from "@/lib/utils";

export type ResumeLesson = {
  courseTitolo: string;
  courseSlug: string;
  lessonSlug: string;
  lessonTitolo: string;
  /** Es. "Modulo 3 · Lezione 4" */
  eyebrow: string;
  ultimoSecondo: number;
  durataSec: number;
  percentCorso: number;
};

/** Card grande "Riprendi la lezione" della dashboard (mockup Main). */
export function ResumeCard({ lesson }: { lesson: ResumeLesson | null }) {
  if (!lesson) return <ResumeEmpty />;
  const href = `/app/corsi/${lesson.courseSlug}/${lesson.lessonSlug}`;
  const visto = percent(lesson.ultimoSecondo, lesson.durataSec);
  return (
    <section
      aria-labelledby="riprendi-titolo"
      className="grid overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[1.27fr_1fr]"
    >
      <Link
        href={href}
        aria-label={`Riprendi ${lesson.lessonTitolo}`}
        className="group relative flex aspect-video flex-col bg-graphite p-5 lg:aspect-auto lg:min-h-78"
      >
        <Eyebrow as="span" className="text-[11px] text-white/80">
          Anteprima video
        </Eyebrow>
        <span className="m-auto flex size-19 items-center justify-center rounded-full bg-nexora-blue text-white transition-colors group-hover:bg-nexora-blue-deep">
          <Play aria-hidden className="size-6 fill-current" />
        </span>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-graphite-deep">
          <span className="block h-full bg-nexora-blue-bright" style={{ width: `${visto}%` }} />
        </span>
      </Link>
      <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
        <Eyebrow tone="muted" className="text-ink">
          {lesson.eyebrow}
        </Eyebrow>
        <h2 id="riprendi-titolo" className="text-2xl leading-tight font-bold">
          {lesson.lessonTitolo}
        </h2>
        <p className="text-[15px] leading-6 text-ink-muted">
          Dal corso «{lesson.courseTitolo}». Ti eri fermato a{" "}
          {formatTimestamp(lesson.ultimoSecondo)} su {formatTimestamp(lesson.durataSec)}.
        </p>
        <div>
          <div className="mb-2 flex justify-between text-[13px]">
            <span>Avanzamento corso</span>
            <span className="font-bold">{Math.round(lesson.percentCorso)}%</span>
          </div>
          <ProgressBar
            value={lesson.percentCorso}
            label="Avanzamento corso"
            size="md"
            track="tint"
          />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild size="lg">
            <Link href={href}>
              <Play aria-hidden className="fill-current" /> Riprendi la lezione
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={`/app/corsi/${lesson.courseSlug}`}>Vai al corso</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function ResumeEmpty() {
  return (
    <section className="grid overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[1.27fr_1fr]">
      <div className="flex aspect-video items-center justify-center bg-graphite lg:aspect-auto lg:min-h-78">
        <span className="flex size-19 items-center justify-center rounded-full bg-white/10 text-white">
          <Play aria-hidden className="size-6 fill-current" />
        </span>
      </div>
      <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
        <Eyebrow tone="muted" className="text-ink">
          Riprendi la lezione
        </Eyebrow>
        <h2 className="text-2xl leading-tight font-bold">Non hai ancora iniziato un corso</h2>
        <p className="text-[15px] leading-6 text-ink-muted">
          Quando guardi una lezione la ritrovi qui, dal minuto in cui ti sei fermato.
        </p>
        <div className="pt-2">
          <Button asChild size="lg">
            <Link href="/corsi">Guarda il catalogo</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
