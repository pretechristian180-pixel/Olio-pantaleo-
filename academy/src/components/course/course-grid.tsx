import { LayoutGrid } from "lucide-react";
import type { Course } from "@/lib/data/courses";
import { isSupabaseConfigured } from "@/lib/env";
import { EmptyState } from "@/components/ui/empty-state";
import { CourseCard } from "./course-card";

export function CourseGrid({ courses }: { courses: Course[] }) {
  if (courses.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="Nessun corso pubblicato"
        description={
          isSupabaseConfigured()
            ? "I corsi in arrivo compariranno qui appena pubblicati."
            : "Collega Supabase in .env.local e carica il seed per vedere il corso di esempio."
        }
      />
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} />
      ))}
    </div>
  );
}
