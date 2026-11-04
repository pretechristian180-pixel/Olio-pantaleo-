import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Stat } from "@/components/ui/stat";
import {
  CourseProgressCard,
  type CourseProgress,
} from "@/components/dashboard/course-progress-card";
import { ResumeCard, type ResumeLesson } from "@/components/dashboard/resume-card";

// Fase 1: struttura del mockup Main. In Fase 2 questi valori arrivano dal database.
const nome: string | null = null;
const resume: ResumeLesson | null = null;
const corsi: CourseProgress[] = [];
const numeri = { attivi: 0, completate: 0, ore: "0", attestati: 0 };

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <Eyebrow>Bentornato</Eyebrow>
        <h1 className="mt-2 text-[32px] leading-tight font-bold">
          {nome
            ? `Ciao ${nome}, riprendi da dove eri rimasto.`
            : "Ciao, riprendi da dove eri rimasto."}
        </h1>
      </div>

      <ResumeCard lesson={resume} />

      <section aria-label="I tuoi numeri" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Corsi attivi" value={numeri.attivi} />
        <Stat label="Lezioni completate" value={numeri.completate} />
        <Stat label="Ore di studio" value={numeri.ore} />
        <Stat label="Attestati ottenuti" value={numeri.attestati} tone="tint" />
      </section>

      <section aria-labelledby="tuoi-corsi">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 id="tuoi-corsi" className="text-[22px] font-semibold">
            I tuoi corsi
          </h2>
          <Link
            href="/corsi"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-nexora-blue hover:text-nexora-blue-deep"
          >
            Vedi tutto il catalogo
          </Link>
        </div>
        {corsi.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nessun corso, per ora"
            description="Scegli un corso dal catalogo: la prima lezione puoi guardarla gratis."
            action={
              <Button asChild>
                <Link href="/corsi">Guarda il catalogo</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {corsi.map((c) => (
              <CourseProgressCard key={c.slug} course={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
