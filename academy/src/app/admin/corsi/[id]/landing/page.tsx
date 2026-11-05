import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getAdminCourse } from "@/lib/data/admin";
import { getLanding } from "@/lib/data/landing";
import { aiUsage } from "@/app/admin/corsi/landing-actions";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { BriefForm } from "@/components/admin/landing/brief-form";
import { LandingEditor } from "@/components/admin/landing/landing-editor";

// La generazione con l'IA può richiedere fino a un minuto.
export const maxDuration = 120;

export default async function LandingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const data = await getAdminCourse(id);
  if (!data) notFound();
  const { course } = data;
  const [landing, uLanding, uSezioni] = await Promise.all([
    getLanding(id),
    aiUsage("landing"),
    aiUsage("sezione"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/admin/corsi/${id}`}
        className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> {course.titolo}
      </Link>
      <div>
        <Eyebrow>Landing di vendita</Eyebrow>
        <h1 className="mt-2 text-[28px] leading-tight font-bold">{course.titolo}</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Rispondi a qualche domanda: l&apos;IA scrive tutta la pagina di vendita con i tuoi colori.
          Poi la ritocchi sezione per sezione e la pubblichi quando ti convince.
        </p>
      </div>
      {landing && landing.sezioni.length ? (
        <LandingEditor
          courseId={id}
          courseSlug={course.slug}
          stato={landing.stato}
          initial={landing.sezioni}
          brief={landing.brief}
          usage={{ landing: uLanding, sezioni: uSezioni }}
        />
      ) : (
        <Card>
          <CardBody className="sm:p-8">
            <CardTitle>Il brief</CardTitle>
            <p className="mt-1 mb-6 text-sm text-ink-muted">
              Titolo, programma, docente e prezzo li prendiamo già dal corso. Qui servono le cose
              che sai solo tu.
            </p>
            <BriefForm courseId={id} usage={uLanding} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
