import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/data/student";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CourseProgressCard } from "@/components/dashboard/course-progress-card";

export default async function MyCoursesPage() {
  const user = await requireUser("/app/corsi");
  const { cards } = await getDashboard(user.id);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Studio" title="I miei corsi" />
      {cards.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nessun corso, per ora"
          description="I corsi che acquisti compaiono qui con il tuo avanzamento."
          action={
            <Button asChild>
              <Link href="/corsi">Guarda il catalogo</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <CourseProgressCard key={c.slug} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}
