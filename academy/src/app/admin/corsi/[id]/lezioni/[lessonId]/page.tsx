import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { isBunnyConfigured } from "@/lib/bunny-admin";
import { getAdminLesson } from "@/lib/data/admin";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DeleteLesson, LessonForm } from "@/components/admin/course/lesson-form";
import { Materials } from "@/components/admin/course/materials";
import { VideoUpload } from "@/components/admin/course/video-upload";

type Props = { params: Promise<{ id: string; lessonId: string }> };

export default async function LessonEditorPage({ params }: Props) {
  await requireStaff();
  const { id, lessonId } = await params;
  const lesson = await getAdminLesson(lessonId);
  if (!lesson || lesson.course_id !== id) notFound();

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/admin/corsi/${id}`}
        className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> {lesson.course.titolo}
      </Link>
      <div>
        <Eyebrow>Lezione</Eyebrow>
        <h1 className="mt-2 text-[28px] leading-tight font-bold">{lesson.titolo}</h1>
        <Link
          href={`/app/corsi/${lesson.course.slug}/${lesson.slug}`}
          target="_blank"
          className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-nexora-blue"
        >
          Guardala come uno studente <ExternalLink aria-hidden className="size-3.5" />
        </Link>
      </div>
      <div className="grid gap-8 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-8">
          <Card>
            <CardBody className="sm:p-8">
              <CardTitle>Video</CardTitle>
              <div className="mt-5">
                <VideoUpload
                  lessonId={lesson.id}
                  hasVideo={!!lesson.bunny_video_id}
                  durataSec={lesson.durata_sec}
                  bunnyAttivo={isBunnyConfigured()}
                />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="sm:p-8">
              <CardTitle>Testi e accesso</CardTitle>
              <div className="mt-5">
                <LessonForm lesson={lesson} />
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="flex flex-col gap-8">
          <Card>
            <CardBody>
              <CardTitle>Materiali</CardTitle>
              <div className="mt-4">
                <Materials
                  tenantId={lesson.course.tenant_id}
                  courseId={id}
                  lessonId={lesson.id}
                  resources={lesson.resources}
                />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <CardTitle>Elimina</CardTitle>
              <div className="mt-3">
                <DeleteLesson courseId={id} lessonId={lesson.id} titolo={lesson.titolo} />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
