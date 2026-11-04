import type { Metadata } from "next";
import { getPublishedCourses } from "@/lib/data/courses";
import { PageHeader } from "@/components/layout/page-header";
import { CourseGrid } from "@/components/course/course-grid";

export const metadata: Metadata = {
  title: "Catalogo corsi",
  description: "Tutti i videocorsi Nexora Academy per imprenditori e PMI.",
  alternates: { canonical: "/corsi" },
};

export default async function CatalogPage() {
  const courses = await getPublishedCourses();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="Catalogo"
        title="Scegli da dove partire"
        description="Ogni corso ha un obiettivo preciso e lezioni brevi. Le prime lezioni le guardi gratis."
      />
      <div className="mt-10">
        <CourseGrid courses={courses} />
      </div>
    </div>
  );
}
