import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCourseEntryLesson } from "@/lib/data/student";

/** "Vai al corso": apre la lezione da cui ripartire. */
export default async function CourseEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/app/corsi/${slug}`);
  const lesson = await getCourseEntryLesson(user.id, slug);
  if (!lesson) notFound();
  redirect(`/app/corsi/${slug}/${lesson.slug}`);
}
