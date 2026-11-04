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

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const colors = [
  ["nexora-blue", "#0042ed", "bg-nexora-blue"],
  ["nexora-blue-deep", "#0024a8", "bg-nexora-blue-deep"],
  ["nexora-blue-bright", "#038bfd", "bg-nexora-blue-bright"],
  ["graphite", "#353a3d", "bg-graphite"],
  ["graphite-deep", "#1d2124", "bg-graphite-deep"],
  ["blue-tint", "#e6edfd", "bg-blue-tint"],
  ["surface-alt", "#f4f6f9", "bg-surface-alt"],
  ["line", "#e3e6eb", "bg-line"],
  ["ink-muted", "#5f646a", "bg-ink-muted"],
  ["positive", "#1f8a4c", "bg-positive"],
  ["negative", "#c62f2f", "bg-negative"],
] as const;

export default function DesignSystemPage() {
  return (
    <main id="contenuto" className="mx-auto max-w-5xl space-y-14 px-4 py-12 sm:px-6">
      <header className="space-y-4">
        <Logo size="lg" />
        <h1 className="text-3xl font-bold">Design system</h1>
        <p className="text-ink-muted">Token e componenti base di Nexora Academy.</p>
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
        <p className="font-display text-4xl">NEXORA 87%</p>
        <Eyebrow>Modulo 3 · Lezione 4</Eyebrow>
        <h2 className="text-2xl font-bold">Titolo in Montserrat 700</h2>
        <p className="max-w-prose text-ink-muted">
          Testo in Montserrat 400. Diretto, concreto, al tu: ti diciamo cosa fare e perché.
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
