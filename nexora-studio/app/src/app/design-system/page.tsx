import type { Metadata } from "next";
import { CheckCircle2, Info, Sparkles, TriangleAlert, Upload, Video } from "lucide-react";

import { NexoraLogo, NexoraMark, NexoraWordmark } from "@/components/brand/logo";
import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { VideoStatusBadge } from "@/components/layout/status-badge";
import { UsageMeter } from "@/components/layout/usage-meter";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { VIDEO_STATUSES } from "@nexora/shared";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const brand = [
  { name: "Blu Christian Prete", token: "--nx-blue-500", hex: "#2B62E8" },
  { name: "Riflesso ciano", token: "--nx-cyan-400", hex: "#45D9FF" },
  { name: "Blu profondo", token: "--nx-blue-700", hex: "#1D3FB8" },
  { name: "Blu chiaro", token: "--nx-blue-300", hex: "#6F9BFF" },
  { name: "Argento", token: "--nx-silver-300", hex: "#C9CBD1" },
  { name: "Inchiostro", token: "--nx-ink-950", hex: "#05070F" },
];

const semantic = [
  ["Sfondo", "bg-background"],
  ["Superficie", "bg-card"],
  ["Secondario", "bg-secondary"],
  ["Accento", "bg-accent"],
  ["Primario", "bg-primary"],
  ["Successo", "bg-success"],
  ["Attenzione", "bg-warning"],
  ["Errore", "bg-destructive"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <PageContainer className="max-w-5xl gap-12">
      <PageHeader
        title="Design system"
        description="La base grafica di Christian Prete Studio: logo, colori, tipografia e componenti. Riferimento interno."
        actions={<ThemeToggle />}
      />

      <Section title="Logo">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex aspect-[4/3] items-center justify-center rounded-xl border bg-nx-ink-950">
            <NexoraMark className="h-20" />
          </div>
          <div className="flex aspect-[4/3] items-center justify-center rounded-xl border bg-white">
            <NexoraMark className="h-20" />
          </div>
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-4 rounded-xl border bg-card">
            <NexoraLogo />
            <NexoraWordmark className="text-xl" />
          </div>
        </div>
      </Section>

      <Section title="Colori del brand">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {brand.map((c) => (
            <div key={c.token} className="overflow-hidden rounded-xl border bg-card">
              <div className="h-16" style={{ background: `var(${c.token})` }} />
              <div className="grid gap-0.5 p-3">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.hex}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-16 rounded-xl bg-brand-gradient" />
          <div className="h-16 rounded-xl" style={{ background: "var(--gradient-silver)" }} />
        </div>
      </Section>

      <Section title="Colori di interfaccia (cambiano col tema)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {semantic.map(([name, cls]) => (
            <div key={name} className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
              <div className={`size-9 rounded-lg border ${cls}`} />
              <span className="text-sm">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografia">
        <div className="grid gap-4 rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">
            Titoli e testo: Instrument Sans · Scritta CHRISTIAN PRETE: Michroma
          </p>
          <p className="font-display text-4xl font-semibold">Tu giri, al resto pensiamo noi.</p>
          <p className="font-display text-2xl font-semibold">I video della settimana</p>
          <p className="font-display text-lg font-semibold">Da approvare</p>
          <p className="max-w-prose text-base">
            Ricevi gli script da girare, carica il video dal telefono e ricevilo montato, pronto da
            approvare e pubblicare sui tuoi social.
          </p>
          <p className="text-sm text-muted-foreground">Testo secondario e descrizioni.</p>
          <p className="text-brand-gradient font-display text-3xl font-semibold">
            Gradiente del brand <span className="text-silver">e argento</span>
          </p>
        </div>
      </Section>

      <Section title="Pulsanti">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="brand">
            <Upload aria-hidden /> Carica il video
          </Button>
          <Button>Approva</Button>
          <Button variant="outline">Chiedi una modifica</Button>
          <Button variant="secondary">Annulla</Button>
          <Button variant="ghost">Altro</Button>
          <Button variant="link">Vedi tutti</Button>
          <Button variant="destructive">Elimina</Button>
          <Button disabled>Disattivato</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Piccolo</Button>
          <Button>Normale</Button>
          <Button size="lg">Grande</Button>
          <Button size="icon" variant="outline" aria-label="Video">
            <Video aria-hidden />
          </Button>
        </div>
      </Section>

      <Section title="Stati dei video">
        <div className="flex flex-wrap gap-2">
          {VIDEO_STATUSES.map((s) => (
            <VideoStatusBadge key={s} status={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Nuovo</Badge>
          <Badge variant="secondary">Bozza</Badge>
          <Badge variant="outline">Instagram</Badge>
          <Badge variant="info">
            <Sparkles aria-hidden /> AI
          </Badge>
        </div>
      </Section>

      <Section title="Moduli">
        <Card>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field id="ds-nome" label="Nome dell'azienda" hint="Come ti conoscono i clienti.">
              {(p) => <Input placeholder="Pizzeria Da Mario" {...p} />}
            </Field>
            <Field id="ds-citta" label="Città" error="Scrivi la città in cui lavori.">
              {(p) => <Input defaultValue="" {...p} />}
            </Field>
            <Field id="ds-tono" label="Come parla la tua azienda?" className="sm:col-span-2">
              {(p) => <Textarea placeholder="Simpatica, diretta, con un tocco di ironia…" {...p} />}
            </Field>
          </CardContent>
        </Card>
      </Section>

      <Section title="Avvisi">
        <div className="grid gap-3">
          <Alert variant="info">
            <Info aria-hidden />
            <AlertTitle>Il video è in montaggio</AlertTitle>
            <AlertDescription>
              Ti mandiamo un&apos;email appena è pronto, di solito entro 15 minuti.
            </AlertDescription>
          </Alert>
          <Alert variant="success">
            <CheckCircle2 aria-hidden />
            <AlertTitle>Video approvato</AlertTitle>
            <AlertDescription>Esce giovedì alle 12:30 su Instagram e Facebook.</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <TriangleAlert aria-hidden />
            <AlertTitle>Hai usato 7 video su 8</AlertTitle>
            <AlertDescription>Passa al piano Pro per avere 12 video al mese.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Card, contatori, caricamento e stato vuoto">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Piano Pro</CardTitle>
              <CardDescription>Si rinnova il 1° dicembre</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <UsageMeter label="Video montati" used={7} total={12} />
              <UsageMeter label="Crediti b-roll AI" used={10} total={36} />
            </CardContent>
            <CardFooter>
              <Button variant="secondary" size="sm">
                Gestisci il piano
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardContent className="grid gap-3">
              <Skeleton className="aspect-[9/16] max-h-48 w-28" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        </div>
        <EmptyState
          icon={Video}
          title="Ancora nessun video"
          description="Carica il primo girato: lo montiamo noi e te lo mandiamo da approvare."
          action={<Button variant="brand">Carica il video</Button>}
        />
      </Section>
    </PageContainer>
  );
}
