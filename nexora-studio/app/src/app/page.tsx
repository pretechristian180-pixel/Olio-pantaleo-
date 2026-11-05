import Link from "next/link";
import { CalendarCheck, Clapperboard, FileText, Upload } from "lucide-react";

import { NexoraLogo, NexoraMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: FileText,
    title: "Ricevi gli script",
    text: "Ogni lunedì trovi i video della settimana: cosa dire, come iniziare, dove girare.",
  },
  {
    icon: Upload,
    title: "Gira e carica",
    text: "Bastano il telefono e pochi minuti. Carichi il video direttamente dall'app.",
  },
  {
    icon: Clapperboard,
    title: "Approva il montaggio",
    text: "Tagli, sottotitoli e musica li fa l'AI. Tu guardi il video e lo approvi.",
  },
  {
    icon: CalendarCheck,
    title: "Pubblichiamo noi",
    text: "Il video esce sui tuoi social nei giorni e negli orari migliori. Mai senza il tuo ok.",
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-aurora"
        aria-hidden
      />

      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <NexoraLogo />
        <Button variant="ghost" size="sm" asChild>
          <Link href="/inizio">Accedi</Link>
        </Button>
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl flex-1 gap-16 px-4 pt-10 pb-20 sm:px-6 lg:pt-20">
        <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-6">
            <p className="text-xs font-semibold tracking-[0.16em] text-primary-text uppercase sm:tracking-[0.24em]">
              Video per la tua azienda, ogni settimana
            </p>
            <h1 className="text-[2.25rem] leading-[1.08] font-semibold text-balance sm:text-5xl lg:text-6xl">
              Tu giri. <span className="text-brand-gradient">Al resto</span>{" "}
              <span className="text-silver">pensiamo noi.</span>
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Script pronti ogni settimana, montaggio con l&apos;AI e pubblicazione sui tuoi social.
              Il lavoro di un social media manager, a una frazione del costo.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="brand" size="lg" asChild>
                <Link href="/inizio">Prova gratis 3 video</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#come-funziona">Come funziona</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Senza carta di credito. Disdici quando vuoi.
            </p>
          </div>

          <div
            className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center"
            aria-hidden
          >
            <div className="absolute inset-[6%] rounded-full border border-nx-blue-500/60 shadow-[0_0_60px_-10px_rgb(10_92_255/0.8),inset_0_0_60px_-20px_rgb(10_92_255/0.6)]" />
            <div className="absolute inset-[22%] rounded-full bg-nx-blue-500/20 blur-3xl" />
            <NexoraMark
              className="relative h-auto w-[52%] drop-shadow-[0_0_24px_rgb(26_168_255/0.45)]"
              title={null}
            />
          </div>
        </section>

        <section id="come-funziona" className="grid scroll-mt-20 gap-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">Come funziona</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="relative grid content-start gap-3 rounded-xl border bg-card/70 p-5 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary-text">
                    <step.icon className="size-5" aria-hidden />
                  </div>
                  <span className="font-wordmark text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="relative border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Nexora Gruppo Digitale</p>
          <p>Siamo in costruzione: la registrazione apre a breve.</p>
        </div>
      </footer>
    </div>
  );
}
