import Link from "next/link";
import { BookOpen } from "lucide-react";
import { displayName, requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/data/student";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Stat } from "@/components/ui/stat";
import { CourseProgressCard } from "@/components/dashboard/course-progress-card";
import { ResumeCard } from "@/components/dashboard/resume-card";
import { PromoBox } from "@/components/student/promo-box";
import { getCurrentTenant } from "@/lib/tenant";

export default async function DashboardPage() {
  const user = await requireUser();
  const [{ cards, resume, numeri }, tenant] = await Promise.all([
    getDashboard(user.id),
    getCurrentTenant(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Eyebrow>Bentornato</Eyebrow>
        <h1 className="mt-2 text-[28px] leading-tight font-bold sm:text-[32px]">
          Ciao {displayName(user)}, {resume ? "riprendi da dove eri rimasto." : "iniziamo."}
        </h1>
      </div>

      <ResumeCard lesson={resume} />

      {/* Su telefono la barra laterale non c'è: il riquadro dell'academy compare qui. */}
      {tenant && <PromoBox promo={tenant.promo} className="md:hidden" />}

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
            className="inline-flex min-h-11 items-center text-sm font-semibold text-nexora-blue-bright hover:text-nexora-blue-bright"
          >
            Vedi tutto il catalogo
          </Link>
        </div>
        {cards.length === 0 ? (
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
            {cards.map((c) => (
              <CourseProgressCard key={c.slug} course={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
