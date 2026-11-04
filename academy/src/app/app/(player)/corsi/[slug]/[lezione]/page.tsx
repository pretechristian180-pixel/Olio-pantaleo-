import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCourseBySlug } from "@/lib/data/courses";
import { getLessonPage } from "@/lib/data/student";
import { embedForLesson } from "@/lib/video";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { LessonActions } from "@/components/lesson/lesson-actions";
import { LessonTabs } from "@/components/lesson/lesson-tabs";
import { ModuleProgram } from "@/components/lesson/module-program";
import { NotesPanel } from "@/components/lesson/notes-panel";
import { PlayerProvider } from "@/components/lesson/player-context";
import { PlayerTopbar } from "@/components/lesson/player-topbar";
import { QuestionsPanel } from "@/components/lesson/questions-panel";
import { ResourcesList } from "@/components/lesson/resources-list";
import { VideoFrame, VideoPlayer } from "@/components/lesson/video-player";

type Props = { params: Promise<{ slug: string; lezione: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, lezione } = await params;
  const course = await getCourseBySlug(slug);
  const lesson = course?.outline.moduli.flatMap((m) => m.lezioni).find((l) => l.slug === lezione);
  return {
    title: lesson && course ? `${lesson.titolo} · ${course.titolo}` : "Lezione",
    robots: { index: false, follow: false },
  };
}

export default async function LessonPage({ params }: Props) {
  const { slug, lezione } = await params;
  const user = await requireUser(`/app/corsi/${slug}/${lezione}`);
  const data = await getLessonPage(user.id, slug, lezione);
  if (!data) notFound();

  const { course, lesson, meta, enrolled, progress, modulo, moduloSuccessivo, next } = data;
  const mine = progress.get(meta.id);
  const startAt = mine && !mine.completata ? mine.ultimo_secondo : 0;
  const embed = lesson ? embedForLesson(lesson.bunny_video_id, startAt) : null;
  const nextHref =
    next && (enrolled || next.isFreePreview) ? `/app/corsi/${slug}/${next.slug}` : null;

  const program = (
    <ModuleProgram
      courseSlug={slug}
      modulo={modulo}
      moduloSuccessivo={moduloSuccessivo}
      currentId={meta.id}
      progress={progress}
      enrolled={enrolled}
    />
  );

  return (
    <PlayerProvider startAt={startAt}>
      <PlayerTopbar courseTitolo={course.titolo} percent={data.percentCorso} />
      <div className="lg:grid lg:min-h-[calc(100dvh-72px)] lg:grid-cols-[1fr_340px]">
        <main id="contenuto" className="min-w-0 md:p-8">
          {lesson ? (
            <VideoPlayer
              lessonId={lesson.id}
              embedUrl={embed?.url ?? null}
              titolo={lesson.titolo}
              durataSec={lesson.durata_sec}
            />
          ) : (
            <VideoFrame>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-white/10">
                  <Lock aria-hidden className="size-6" />
                </span>
                <p className="max-w-sm text-[15px]">Questa lezione fa parte del corso completo.</p>
                <Button asChild variant="inverse">
                  <Link href={`/corsi/${slug}`}>Scopri il corso</Link>
                </Button>
              </div>
            </VideoFrame>
          )}

          <div className="flex flex-col gap-5 px-4 pt-5 md:flex-row md:items-start md:justify-between md:px-0 md:pt-6">
            <div>
              <Eyebrow>{data.eyebrow}</Eyebrow>
              <h1 className="mt-2 text-[22px] leading-tight font-bold sm:text-[28px]">
                {meta.titolo}
              </h1>
            </div>
            {lesson && (
              <LessonActions
                lessonId={lesson.id}
                completata={!!mine?.completata}
                nextHref={nextHref}
              />
            )}
          </div>

          <div className="mt-4">
            <LessonTabs
              items={[
                { id: "lezioni", label: "Lezioni", content: program, mobileOnly: true },
                {
                  id: "descrizione",
                  label: "Descrizione",
                  content: (
                    <p className="max-w-190 text-[15px] leading-7 whitespace-pre-line">
                      {lesson?.descrizione || "Nessuna descrizione per questa lezione."}
                    </p>
                  ),
                },
                {
                  id: "materiali",
                  label: "Materiali",
                  content: lesson ? <ResourcesList resources={data.resources} /> : <LockedNote />,
                },
                {
                  id: "note",
                  label: "Le mie note",
                  content: lesson ? (
                    <NotesPanel lessonId={lesson.id} initial={data.notes} />
                  ) : (
                    <LockedNote />
                  ),
                },
                {
                  id: "domande",
                  label: "Domande",
                  content: lesson ? (
                    <QuestionsPanel lessonId={lesson.id} thread={data.thread} canAsk={enrolled} />
                  ) : (
                    <LockedNote />
                  ),
                },
              ]}
            />
          </div>
        </main>
        <aside
          aria-label="Programma del modulo"
          className="hidden border-l border-line bg-surface-alt p-6 lg:block"
        >
          {program}
        </aside>
      </div>
    </PlayerProvider>
  );
}

function LockedNote() {
  return <p className="text-[15px] text-ink-muted">Disponibile per chi è iscritto al corso.</p>;
}
