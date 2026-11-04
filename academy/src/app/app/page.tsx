import Link from "next/link";
import { BookOpen, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Stat } from "@/components/ui/stat";

// Fase 1: struttura della dashboard con stati vuoti. I dati reali arrivano in Fase 2.
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Ciao, bentornato.</h1>
        <p className="mt-1 text-ink-muted">Riprendi da dove avevi lasciato.</p>
      </div>

      <Card tone="dark">
        <CardBody className="flex flex-col gap-6 sm:flex-row sm:items-center sm:p-8">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-nexora-blue">
            <PlayCircle aria-hidden className="size-7" />
          </span>
          <div className="flex-1">
            <Eyebrow tone="bright">Riprendi la lezione</Eyebrow>
            <p className="mt-2 text-lg font-semibold">Non hai ancora iniziato un corso</p>
            <p className="mt-1 text-sm text-white/70">
              Quando guardi una lezione la ritrovi qui, dal minuto in cui ti sei fermato.
            </p>
          </div>
          <Button asChild variant="inverse">
            <Link href="/corsi">Vai al catalogo</Link>
          </Button>
        </CardBody>
      </Card>

      <section aria-label="I tuoi numeri" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Corsi attivi" value={0} />
        <Stat label="Lezioni completate" value={0} />
        <Stat label="Ore di studio" value="0" />
        <Stat label="Attestati" value={0} />
      </section>

      <section aria-labelledby="tuoi-corsi">
        <h2 id="tuoi-corsi" className="mb-5 text-xl font-bold">
          I tuoi corsi
        </h2>
        <EmptyState
          icon={BookOpen}
          title="Nessun corso, per ora"
          description="Scegli un corso dal catalogo: le prime lezioni puoi guardarle gratis."
          action={
            <Button asChild>
              <Link href="/corsi">Guarda il catalogo</Link>
            </Button>
          }
        />
      </section>
    </div>
  );
}
