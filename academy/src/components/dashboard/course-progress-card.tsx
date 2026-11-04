import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { pluralize } from "@/lib/utils";

export type CourseProgress = {
  slug: string;
  titolo: string;
  copertinaUrl: string | null;
  moduli: number;
  lezioni: number;
  percent: number;
  haAttestato: boolean;
};

/** Card "I tuoi corsi" della dashboard (mockup Main). */
export function CourseProgressCard({ course }: { course: CourseProgress }) {
  const completato = course.percent >= 100;
  return (
    <Link
      href={`/app/corsi/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-nexora-blue"
    >
      <div className="relative h-37.5 bg-graphite">
        {course.copertinaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.copertinaUrl} alt="" className="size-full object-cover" />
        )}
        <Badge tone={completato ? "positive" : "solid"} className="absolute bottom-4 left-4">
          {completato ? "Completato" : "In corso"}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-base leading-snug font-bold group-hover:text-nexora-blue">
          {course.titolo}
        </h3>
        <p className="text-[13px] text-ink-muted">
          {pluralize(course.moduli, "modulo", "moduli")} ·{" "}
          {pluralize(course.lezioni, "lezione", "lezioni")}
        </p>
        <ProgressBar
          value={course.percent}
          label={`Avanzamento ${course.titolo}`}
          tone={completato ? "positive" : "light"}
          track="tint"
          className="mt-2"
        />
        <p className="text-[13px] font-bold">
          {completato && course.haAttestato
            ? "Attestato disponibile"
            : `${Math.round(course.percent)}% completato`}
        </p>
      </div>
    </Link>
  );
}
