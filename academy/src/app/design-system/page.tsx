import type { Metadata } from "next";
import { ArrowRight, BookOpen, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Logo } from "@/components/ui/logo";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Stat } from "@/components/ui/stat";
import { CourseProgressCard } from "@/components/dashboard/course-progress-card";
import { ResumeCard } from "@/components/dashboard/resume-card";
import { BusinessBox } from "@/components/course/business-box";
import { CourseProgram } from "@/components/course/course-program";
import { InstructorCard } from "@/components/course/instructor-card";
import { PurchaseCard } from "@/components/course/purchase-card";
import { buildOutline } from "@/lib/course-outline";

// Dati di esempio presi dai mockup, solo per questa vetrina.
const esempioOutline = buildOutline(
  (
    [
      [
        1,
        "Perché la tua azienda perde clienti",
        "Il costo dei clienti che non richiami",
        460,
        true,
      ],
      [
        1,
        "Perché la tua azienda perde clienti",
        "WhatsApp, email, fogli: la mappa del caos",
        665,
        false,
      ],
      [2, "Scegliere e impostare il CRM", "I cinque criteri per scegliere il CRM", 660, false],
      [3, "Pipeline e fasi di vendita", "Le pipeline di vendita nel CRM", 1170, false],
    ] as const
  ).map(([ordine, modulo, lezione, durata, gratis], i) => ({
    module_id: `m${ordine}`,
    module_titolo: modulo,
    module_ordine: ordine,
    lesson_id: `l${i}`,
    lesson_slug: `l${i}`,
    lesson_titolo: lezione,
    durata_sec: durata,
    is_free_preview: gratis,
    lesson_ordine: i,
  })),
);

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const colors = [
  ["nexora-blue", "#2b62e8", "bg-nexora-blue"],
  ["nexora-blue-deep", "#1d3fb8", "bg-nexora-blue-deep"],
  ["nexora-blue-bright", "#45d9ff", "bg-nexora-blue-bright"],
  ["graphite", "#141d40", "bg-graphite"],
  ["graphite-deep", "#0b1124", "bg-graphite-deep"],
  ["blue-tint", "#16245a", "bg-blue-tint"],
  ["surface-alt", "#05070f", "bg-surface-alt"],
  ["line", "#1f2a4d", "bg-line"],
  ["ink-muted", "#93a0c2", "bg-ink-muted"],
  ["positive", "#4ade80", "bg-positive"],
  ["negative", "#ff6b6b", "bg-negative"],
] as const;

export default function DesignSystemPage() {
  return (
    <main id="contenuto" className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6">
      <header className="space-y-4">
        <Logo size="lg" />
        <h1 className="text-3xl font-bold">Design system</h1>
        <p className="text-ink-muted">Token e componenti base di Christian Prete Academy.</p>
      </header>

      <section className="space-y-4">
        <Eyebrow>Colori</Eyebrow>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {colors.map(([name, hex, cls]) => (
            <div key={name} className="overflow-hidden rounded-lg border border-line bg-surface">
              <div className={`h-16 ${cls}`} />
              <div className="p-3 text-xs">
                <p className="font-semibold">{name}</p>
                <p className="text-ink-muted">{hex}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <Eyebrow>Tipografia</Eyebrow>
        <p className="font-display text-4xl">CP ACADEMY 87%</p>
        <Eyebrow>Modulo 3 · Lezione 4</Eyebrow>
        <h2 className="text-2xl font-bold">Titolo in Instrument Sans 700</h2>
        <p className="max-w-prose text-ink-muted">
          Testo in Instrument Sans 400. Diretto, concreto, al tu: ti diciamo cosa fare e perché.
        </p>
      </section>

      <section className="space-y-4">
        <Eyebrow>Pulsanti</Eyebrow>
        <div className="flex flex-wrap gap-3">
          <Button>Acquista il corso</Button>
          <Button variant="secondary">Guarda una lezione gratis</Button>
          <Button variant="ghost">Annulla</Button>
          <Button variant="dark">
            Lezione successiva <ArrowRight aria-hidden />
          </Button>
          <Button size="icon" aria-label="Riproduci">
            <Play aria-hidden />
          </Button>
          <Button disabled>Disattivato</Button>
        </div>
        <div className="flex flex-wrap gap-3 rounded-lg bg-graphite-deep p-5">
          <Button variant="inverse">Vai al corso</Button>
          <Button variant="outline-inverse">Accedi</Button>
          <Logo tone="dark" href={null} />
        </div>
      </section>

      <section className="space-y-4">
        <Eyebrow>Badge e avanzamento</Eyebrow>
        <div className="flex flex-wrap gap-2">
          <Badge>Gratis</Badge>
          <Badge tone="solid">Nuovo</Badge>
          <Badge tone="positive">Pubblicato</Badge>
          <Badge tone="neutral">Bozza</Badge>
          <Badge tone="negative">Rimborsato</Badge>
        </div>
        <ProgressBar value={42} showValue />
        <div className="rounded-lg bg-graphite-deep p-5">
          <ProgressBar value={87} showValue tone="dark" size="md" />
        </div>
      </section>

      <section className="space-y-4">
        <Eyebrow>Dashboard studente</Eyebrow>
        <ResumeCard
          lesson={{
            courseTitolo: "CRM e automazioni per PMI",
            courseSlug: "crm-e-automazioni-per-pmi",
            lessonSlug: "le-pipeline-di-vendita-nel-crm",
            lessonTitolo: "Le pipeline di vendita nel CRM",
            eyebrow: "Modulo 3 · Lezione 4",
            ultimoSecondo: 494,
            durataSec: 1170,
            percentCorso: 42,
          }}
        />
        <ResumeCard lesson={null} />
        <div className="grid gap-5 sm:grid-cols-3">
          <CourseProgressCard
            course={{
              slug: "a",
              titolo: "CRM e automazioni per PMI",
              copertinaUrl: null,
              moduli: 6,
              lezioni: 32,
              percent: 42,
              haAttestato: false,
            }}
          />
          <CourseProgressCard
            course={{
              slug: "b",
              titolo: "AI in azienda: da dove partire",
              copertinaUrl: null,
              moduli: 4,
              lezioni: 18,
              percent: 15,
              haAttestato: false,
            }}
          />
          <CourseProgressCard
            course={{
              slug: "c",
              titolo: "Personal branding per imprenditori",
              copertinaUrl: null,
              moduli: 5,
              lezioni: 24,
              percent: 100,
              haAttestato: true,
            }}
          />
        </div>
      </section>

      <section className="space-y-4">
        <Eyebrow>Pagina corso</Eyebrow>
        <div className="grid gap-8 rounded-lg bg-graphite-deep p-6 lg:grid-cols-[1fr_340px]">
          <p className="text-white">Hero del corso (vedi /corsi/[slug])</p>
          <PurchaseCard prezzoCents={19700} valuta="EUR" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <CourseProgram outline={esempioOutline} />
          <div className="flex flex-col gap-4">
            <InstructorCard
              nome="Christian Prete"
              bio="Founder di Christian Prete Agency. Ogni giorno costruisce CRM, automazioni e sistemi per aziende italiane: nel corso ti mostra come li fa."
            />
            <BusinessBox />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <Eyebrow tone="muted">Scheda</Eyebrow>
            <CardTitle className="mt-2">Una scheda per concetto</CardTitle>
            <p className="mt-2 text-sm text-ink-muted">Bordo sottile, raggio 14px, molto spazio.</p>
          </CardBody>
        </Card>
        <Card tone="tint">
          <CardBody>
            <CardTitle>Riquadro di evidenza</CardTitle>
            <p className="mt-2 text-sm text-ink">Per offerte, consigli e voci selezionate.</p>
          </CardBody>
        </Card>
        <Stat label="Lezioni completate" value={14} hint="Su 20" />
        <EmptyState
          icon={BookOpen}
          title="Stato vuoto"
          description="Cosa succede qui e cosa fare."
        />
      </section>
    </main>
  );
}
