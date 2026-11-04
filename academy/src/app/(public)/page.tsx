import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPublishedCourses } from "@/lib/data/courses";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CourseGrid } from "@/components/course/course-grid";

export default async function HomePage() {
  const courses = await getPublishedCourses();
  return (
    <>
      <section className="bg-graphite-deep text-white">
        <div className="mx-auto max-w-310 px-4 py-20 sm:px-6 sm:py-28">
          <Eyebrow tone="muted" className="text-ink-inverse-muted">
            Formazione per imprenditori
          </Eyebrow>
          <h1 className="mt-5 max-w-3xl font-display text-3xl leading-[1.35] uppercase sm:text-5xl">
            Meno improvvisazione. Più sistema.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/80">
            I corsi Nexora su CRM, automazioni, AI e marketing aziendale. Pratici, registrati da chi
            questi sistemi li costruisce ogni giorno.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/corsi">
                Guarda i corsi <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline-inverse">
              <Link href="/accedi">Hai già un corso? Accedi</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-310 px-4 py-16 sm:px-6">
        <Eyebrow>Catalogo</Eyebrow>
        <h2 className="mt-2 mb-8 text-2xl font-bold">I corsi disponibili</h2>
        <CourseGrid courses={courses} />
      </section>
    </>
  );
}
