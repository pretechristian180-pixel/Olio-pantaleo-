import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, ListVideo, MonitorPlay } from "lucide-react";
import { getCourseBySlug } from "@/lib/data/courses";
import { formatDuration, pluralize } from "@/lib/utils";
import { Avatar, initials } from "@/components/ui/avatar";
import { Eyebrow } from "@/components/ui/eyebrow";
import { BusinessBox } from "@/components/course/business-box";
import { CourseProgram } from "@/components/course/course-program";
import { InstructorCard } from "@/components/course/instructor-card";
import { PurchaseCard } from "@/components/course/purchase-card";

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

export default async function CoursePage({ params }: Props) {
  const course = await getCourseBySlug((await params).slug);
  if (!course) notFound();
  const { outline, docente } = course;
  const [nomeDocente, ...cognomeDocente] = (docente?.nome ?? "").split(" ");

  return (
    <>
      <section className="bg-graphite-deep text-white">
        <div className="mx-auto grid max-w-310 gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_340px] lg:gap-16 lg:py-16">
          <div>
            <Eyebrow tone="bright">
              Videocorso{course.categoria ? ` · ${course.categoria}` : ""}
            </Eyebrow>
            <h1 className="mt-5 text-4xl leading-tight font-bold sm:text-5xl">{course.titolo}</h1>
            {course.sottotitolo && (
              <p className="mt-6 max-w-155 text-lg leading-7 text-ink-inverse-muted">
                {course.sottotitolo}
              </p>
            )}
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
              <li className="inline-flex items-center gap-2">
                <MonitorPlay aria-hidden className="size-4 text-nexora-blue-bright" />
                {pluralize(outline.totaleLezioni, "lezione video", "lezioni video")}
              </li>
              <li className="inline-flex items-center gap-2">
                <ListVideo aria-hidden className="size-4 text-nexora-blue-bright" />
                {pluralize(outline.moduli.length, "modulo", "moduli")}
              </li>
              <li className="inline-flex items-center gap-2">
                <Clock aria-hidden className="size-4 text-nexora-blue-bright" />
                {formatDuration(outline.totaleDurataSec)}
              </li>
            </ul>
            {docente && (
              <div className="mt-8 flex items-center gap-3">
                <Avatar
                  name={initials(nomeDocente, cognomeDocente.join(" "))}
                  className="size-12"
                />
                <div>
                  <p className="text-[15px] font-semibold">{docente.nome}</p>
                  {docente.qualifica && (
                    <p className="text-[13px] text-ink-inverse-muted">{docente.qualifica}</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <PurchaseCard prezzoCents={course.prezzo_cents} valuta={course.valuta} />
        </div>
      </section>

      <div className="bg-surface">
        <div className="mx-auto grid max-w-310 gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_300px] lg:px-8">
          <div className="flex min-w-0 flex-col gap-14">
            {course.risultati.length > 0 && (
              <section aria-labelledby="risultati">
                <Eyebrow>Cosa porti a casa</Eyebrow>
                <h2 id="risultati" className="mt-3 text-[28px] leading-tight font-bold">
                  Alla fine del corso avrai un sistema, non solo appunti.
                </h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {course.risultati.map((r) => (
                    <li key={r.titolo} className="rounded-lg bg-surface-alt p-6">
                      <h3 className="font-bold">{r.titolo}</h3>
                      <p className="mt-2 text-sm leading-6 text-ink-muted">{r.testo}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <CourseProgram outline={outline} />
          </div>
          <div className="flex flex-col gap-4">
            {docente && <InstructorCard nome={docente.nome} bio={docente.bio} />}
            <BusinessBox />
          </div>
        </div>
      </div>
    </>
  );
}
