import Link from "next/link";
import { Clock, PlayCircle } from "lucide-react";
import type { Course } from "@/lib/data/courses";
import { formatDuration, formatPrice, pluralize } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";

/** Copertina senza immagine: fondo scuro e titolo in Michroma. */
export function CourseCover({ titolo, url }: { titolo: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="aspect-video w-full rounded-t-lg object-cover" />;
  }
  return (
    <div className="flex aspect-video w-full items-end rounded-t-lg bg-graphite-deep p-5">
      <p className="line-clamp-3 font-display text-sm leading-relaxed text-white uppercase">
        {titolo}
      </p>
    </div>
  );
}

export function CourseCard({ course, progress }: { course: Course; progress?: number }) {
  const { outline } = course;
  return (
    <Link
      href={`/corsi/${course.slug}`}
      className="group flex flex-col rounded-lg border border-line bg-surface transition-colors hover:border-nexora-blue"
    >
      <CourseCover titolo={course.titolo} url={course.copertinaUrl} />
      <div className="flex flex-1 flex-col p-5">
        {outline.lezioniGratuite > 0 && progress === undefined && (
          <Badge className="mb-3 self-start">
            {pluralize(outline.lezioniGratuite, "lezione gratis", "lezioni gratis")}
          </Badge>
        )}
        <h3 className="text-lg leading-snug font-semibold group-hover:text-nexora-blue">
          {course.titolo}
        </h3>
        {course.sottotitolo && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{course.sottotitolo}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <PlayCircle aria-hidden className="size-4" />
            {pluralize(outline.totaleLezioni, "lezione", "lezioni")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-4" />
            {formatDuration(outline.totaleDurataSec)}
          </span>
        </div>
        <div className="mt-auto pt-5">
          {progress === undefined ? (
            <p className="text-lg font-bold">{formatPrice(course.prezzo_cents, course.valuta)}</p>
          ) : (
            <ProgressBar value={progress} showValue label={`Avanzamento ${course.titolo}`} />
          )}
        </div>
      </div>
    </Link>
  );
}
