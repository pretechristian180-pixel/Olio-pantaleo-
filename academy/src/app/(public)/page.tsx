import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPublishedCourses } from "@/lib/data/courses";
import { getCurrentTenant, isNexoraTenant } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CourseGrid } from "@/components/course/course-grid";

export default async function HomePage() {
  const [courses, nexora, tenant] = await Promise.all([
    getPublishedCourses(),
    isNexoraTenant(),
    getCurrentTenant(),
  ]);
  return (
    <>
      <section className="bg-graphite-deep text-white">
        <div className="mx-auto max-w-310 px-4 py-20 sm:px-6 sm:py-28">
          {nexora ? (
            <>
              <Eyebrow tone="muted" className="text-ink-inverse-muted">
                Formazione per imprenditori
              </Eyebrow>
              <h1 className="mt-5 max-w-3xl font-display text-[clamp(1.5rem,6.5vw,3rem)] leading-[1.35] uppercase">
                Meno improvvisazione. Più sistema.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/80">
                I corsi Nexora su CRM, automazioni, AI e marketing aziendale. Pratici, registrati da
                chi questi sistemi li costruisce ogni giorno.
              </p>
            </>
          ) : (
            <>
              <Eyebrow tone="bright">Videocorsi online</Eyebrow>
              <h1 className="mt-5 max-w-3xl text-[clamp(2rem,6vw,3.5rem)] leading-tight font-bold">
                {tenant?.nome}
              </h1>
              {tenant?.brand.tagline && (
                <p className="mt-6 max-w-xl text-lg text-white/80">{tenant.brand.tagline}</p>
              )}
            </>
          )}
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
