import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";
import { getAdminCourse } from "@/lib/data/admin";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CourseForm } from "@/components/admin/course/course-form";
import { CourseStatus, DeleteCourse } from "@/components/admin/course/course-status";
import { CoverUpload } from "@/components/admin/course/cover-upload";
import { InstructorForm } from "@/components/admin/course/instructor-form";
import { ProgramEditor } from "@/components/admin/course/program-editor";

export default async function CourseEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const data = await getAdminCourse((await params).id);
  if (!data) notFound();
  const { course, instructors } = data;
  const lezioni = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/admin/corsi"
        className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Tutti i corsi
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Corso</Eyebrow>
          <h1 className="mt-2 text-[28px] leading-tight font-bold">{course.titolo}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {course.modules.length} moduli · {lezioni} lezioni ·{" "}
            <Link
              href={`/corsi/${course.slug}`}
              className="inline-flex items-center gap-1 font-semibold text-nexora-blue"
              target="_blank"
            >
              Vedi la pagina pubblica <ExternalLink aria-hidden className="size-3.5" />
            </Link>
          </p>
        </div>
        <CourseStatus courseId={course.id} stato={course.stato} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          <Card>
            <CardBody className="sm:p-8">
              <CardTitle>Programma</CardTitle>
              <div className="mt-5">
                <ProgramEditor courseId={course.id} initial={course.modules} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="sm:p-8">
              <CardTitle>Dati del corso</CardTitle>
              <div className="mt-5">
                <CourseForm course={course} instructors={instructors} />
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="flex flex-col gap-8">
          <Card tone="tint">
            <CardBody>
              <CardTitle>Landing di vendita</CardTitle>
              <p className="mt-1 mb-4 text-sm">
                L&apos;IA scrive la pagina che vende il corso, tu la rifinisci e la pubblichi.
              </p>
              <Button asChild>
                <Link href={`/admin/corsi/${course.id}/landing`}>
                  <Sparkles aria-hidden /> Crea con l&apos;IA
                </Link>
              </Button>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <CardTitle>Copertina</CardTitle>
              <div className="mt-4">
                <CoverUpload
                  courseId={course.id}
                  tenantId={course.tenant_id}
                  url={course.copertinaUrl}
                />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <CardTitle>Docenti</CardTitle>
              <p className="mt-1 mb-4 text-sm text-ink-muted">
                Scegli il docente nei dati del corso, o aggiungine uno nuovo.
              </p>
              <InstructorForm courseId={course.id} />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <CardTitle>Elimina</CardTitle>
              <div className="mt-3">
                <DeleteCourse courseId={course.id} titolo={course.titolo} />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
