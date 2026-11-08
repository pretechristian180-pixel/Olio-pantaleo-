import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck,
  CheckCircle2,
  Clapperboard,
  FileText,
  Music2,
  ScanFace,
  Scissors,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

import { NexoraLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { euro } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Christian Prete Studio — Video per i social della tua azienda, ogni settimana" },
  description:
    "Ricevi ogni settimana gli script, giri con il telefono e ricevi il video montato con l'AI: sottotitoli, tagli e musica. Lo approvi e lo pubblichiamo sui tuoi social. Prova gratis 3 video.",
  openGraph: {
    title: "Christian Prete Studio — Tu giri. Al resto pensiamo noi.",
    description:
      "Script settimanali, montaggio con l'AI e pubblicazione sui tuoi social. Prova gratis 3 video, senza carta.",
    locale: "it_IT",
    type: "website",
  },
};

const steps = [
  {
    icon: FileText,
    title: "Ricevi gli script",
    text: "Ogni lunedì trovi i video della settimana: cosa dire, la frase d'apertura, dove e come girare.",
  },
  {
    icon: Upload,
    title: "Gira e carica",
    text: "Bastano il telefono e pochi minuti. Carichi il video dall'app, anche con una connessione lenta.",
  },
  {
    icon: Clapperboard,
    title: "Approva il montaggio",
    text: "Tagli, sottotitoli e musica li fa l'AI. Guardi il video, chiedi una modifica o lo approvi.",
  },
  {
    icon: CalendarCheck,
    title: "Pubblichiamo noi",
    text: "Il video esce sui tuoi social nei giorni e negli orari che hai scelto. Mai senza il tuo ok.",
  },
];

const features = [
  {
    icon: Scissors,
    title: "Tagli e ritmo",
    text: "Via pause, esitazioni e ripetizioni: resta solo quello che serve, con il ritmo dei social.",
  },
  {
    icon: ScanFace,
    title: "Sottotitoli che non coprono i volti",
    text: "Parola per parola, con le parole chiave evidenziate. Si spostano da soli per non coprire chi parla.",
  },
  {
    icon: Music2,
    title: "Musica e voce bilanciate",
    text: "Una base adatta al tuo stile che si abbassa quando parli. Volume pronto per Instagram e TikTok.",
  },
  {
    icon: Sparkles,
    title: "Immagini di supporto",
    text: "Quando parli di un prodotto o di un luogo, brevi clip di supporto rendono il video più vivo.",
  },
  {
    icon: ShieldCheck,
    title: "Niente esce senza di te",
    text: "Ogni video aspetta la tua approvazione. Hai due giri di modifiche inclusi per ogni video.",
  },
  {
    icon: CalendarCheck,
    title: "Calendario ordinato",
    text: "Vedi cosa esce e quando, sposti un post con un dito. Instagram, Facebook, TikTok, YouTube, LinkedIn.",
  },
];

const sectors = [
  "Ristoranti e bar",
  "Estetica e benessere",
  "Officine e concessionarie",
  "Agenzie immobiliari",
  "Studi professionali",
  "Negozi",
  "Palestre",
  "Artigiani",
  "Turismo",
];

const faqs = [
  {
    q: "Devo saper montare o usare programmi?",
    a: "No. Ti serve solo il telefono: giri seguendo lo script, carichi il video e al montaggio pensiamo noi.",
  },
  {
    q: "Quanto tempo ci vuole per avere il video?",
    a: "Il montaggio è pronto in pochi minuti dal caricamento. Nei primi tempi lo controlla anche il nostro team prima di mandartelo: ti arriva un'email quando è da approvare.",
  },
  {
    q: "Pubblicate qualcosa senza il mio permesso?",
    a: "Mai. Un video entra in calendario solo dopo che l'hai approvato, e puoi spostarlo o toglierlo fino a 20 minuti prima dell'uscita.",
  },
  {
    q: "Devo darvi le password dei social?",
    a: "No. Colleghi i tuoi profili da una pagina sicura del nostro partner di pubblicazione e autorizzi solo la pubblicazione dei post.",
  },
  {
    q: "E se il video non mi piace?",
    a: 'Scrivi a parole tue cosa cambiare ("togli l\'inizio", "musica più bassa") e ricevi la nuova versione. Due giri di modifiche sono inclusi per ogni video.',
  },
  {
    q: "Ho più attività: posso gestirle insieme?",
    a: "Sì. Con il piano Business un solo abbonamento copre fino a 3 brand, ciascuno con i suoi video, i suoi social e il suo calendario.",
  },
  {
    q: "Come funziona la prova? Posso disdire?",
    a: "La prova include 3 video montati, senza carta di credito. Dopo scegli un piano mensile o annuale; disdici quando vuoi e i tuoi video restano tuoi.",
  },
];

async function getPlans() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("plans")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function Home(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const yearly = sp.periodo === "annuale";
  const plans = await getPlans();

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-aurora"
        aria-hidden
      />

      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <NexoraLogo />
        <nav
          aria-label="Pagina"
          className="hidden gap-6 text-sm font-medium text-muted-foreground md:flex"
        >
          <a href="#come-funziona" className="hover:text-foreground">
            Come funziona
          </a>
          <a href="#prezzi" className="hover:text-foreground">
            Prezzi
          </a>
          <a href="#domande" className="hover:text-foreground">
            Domande
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/accedi">Accedi</Link>
          </Button>
          <Button size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/registrati">Prova gratis</Link>
          </Button>
        </div>
      </header>

      <main
        id="contenuto"
        className="relative mx-auto grid w-full max-w-6xl flex-1 gap-20 px-4 pt-10 pb-20 sm:gap-28 sm:px-6 lg:pt-16"
      >
        {/* Apertura */}
        <section className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="grid gap-6">
            <p className="text-xs font-semibold tracking-[0.16em] text-primary-text uppercase sm:tracking-[0.24em]">
              Video per la tua azienda, ogni settimana
            </p>
            <h1 className="text-[2.25rem] leading-[1.08] font-semibold text-balance sm:text-5xl lg:text-6xl">
              Tu giri. <span className="text-brand-gradient">Al resto</span>{" "}
              <span className="text-silver">pensiamo noi.</span>
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Ogni settimana ricevi gli script dei video da girare. Carichi il girato dal telefono e
              ricevi il video montato con l&apos;AI: tagli, sottotitoli e musica. Lo approvi e lo
              pubblichiamo sui tuoi social.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="brand" size="lg" asChild>
                <Link href="/registrati">Prova gratis 3 video</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#come-funziona">Come funziona</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Senza carta di credito. Disdici quando vuoi.
            </p>
          </div>
          <PhonePreview />
        </section>

        {/* Come funziona */}
        <section
          id="come-funziona"
          className="grid scroll-mt-20 gap-8"
          aria-labelledby="come-funziona-titolo"
        >
          <div className="grid gap-2">
            <h2 id="come-funziona-titolo" className="text-2xl font-semibold sm:text-3xl">
              Come funziona
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Quattro passaggi, e il tuo impegno è il secondo: girare. Bastano pochi minuti a
              settimana.
            </p>
          </div>
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

        {/* Cosa fa il montaggio */}
        <section className="grid gap-8" aria-labelledby="montaggio-titolo">
          <div className="grid gap-2">
            <h2 id="montaggio-titolo" className="text-2xl font-semibold sm:text-3xl">
              Il montaggio che faresti tu,{" "}
              <span className="text-brand-gradient">se avessi il tempo</span>
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Lo stile lo scegli all&apos;inizio: ritmo, sottotitoli, musica. Ogni video lo segue.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li
                key={f.title}
                className="grid content-start gap-2 rounded-xl border bg-card/50 p-5"
              >
                <f.icon className="size-5 text-primary-text" aria-hidden />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Per chi */}
        <section
          className="grid gap-6 rounded-2xl border bg-card/60 p-6 sm:p-8"
          aria-labelledby="per-chi-titolo"
        >
          <div className="grid gap-2">
            <h2 id="per-chi-titolo" className="text-2xl font-semibold sm:text-3xl">
              Pensato per chi ha un&apos;attività da mandare avanti
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Gli script partono dal tuo settore, dai tuoi servizi, dalla tua città e dalle
              ricorrenze italiane della settimana.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {sectors.map((s) => (
              <li key={s} className="rounded-full border bg-background/50 px-3 py-1.5 text-sm">
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* Prezzi */}
        <section id="prezzi" className="grid scroll-mt-20 gap-8" aria-labelledby="prezzi-titolo">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-2">
              <h2 id="prezzi-titolo" className="text-2xl font-semibold sm:text-3xl">
                Prezzi chiari
              </h2>
              <p className="max-w-2xl text-muted-foreground">
                Inizi con 3 video gratis, senza carta. Prezzi IVA esclusa; con l&apos;annuale paghi
                10 mesi invece di 12.
              </p>
            </div>
            <div
              className="inline-flex rounded-xl border bg-card p-1 text-sm"
              role="group"
              aria-label="Periodicità"
            >
              {[
                { href: "/#prezzi", label: "Mensile", on: !yearly },
                { href: "/?periodo=annuale#prezzi", label: "Annuale −2 mesi", on: yearly },
              ].map((o) => (
                <Link
                  key={o.label}
                  href={o.href}
                  scroll={false}
                  aria-current={o.on ? "true" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-medium transition-colors",
                    o.on
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </Link>
              ))}
            </div>
          </div>
          {plans.length > 0 && (
            <ul className="grid gap-4 md:grid-cols-3">
              {plans.map((p) => {
                const popular = p.id === "pro";
                const monthly = yearly
                  ? Math.round(p.price_yearly_cents / 12)
                  : p.price_monthly_cents;
                const per = p.brands_max > 1 ? " per brand" : "";
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "relative grid content-start gap-4 rounded-2xl border bg-card p-6",
                      popular && "border-nx-blue-500/60 shadow-glow",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                      {popular && (
                        <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-primary-text">
                          Il più scelto
                        </span>
                      )}
                    </div>
                    <p>
                      <span className="font-display text-4xl font-semibold">{euro(monthly)}</span>
                      <span className="text-sm text-muted-foreground"> /mese</span>
                      {yearly && (
                        <span className="block text-xs text-muted-foreground">
                          {euro(p.price_yearly_cents)} all&apos;anno
                        </span>
                      )}
                    </p>
                    <ul className="grid gap-2 text-sm">
                      {[
                        `${p.videos_per_month} video montati al mese${per}`,
                        `${p.social_accounts_max} social collegati${per}`,
                        p.broll_credits_month > 0
                          ? `${p.broll_credits_month} clip di supporto al mese${per}`
                          : "Senza clip di supporto",
                        p.brands_max > 1 ? `Fino a ${p.brands_max} brand` : "1 brand",
                        "Script ogni settimana e pubblicazione",
                      ].map((f) => (
                        <li key={f} className="flex gap-2">
                          <CheckCircle2
                            className="mt-0.5 size-4 shrink-0 text-success"
                            aria-hidden
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button variant={popular ? "brand" : "outline"} size="lg" asChild>
                      <Link href="/registrati">Inizia con 3 video gratis</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Domande */}
        <section
          id="domande"
          className="grid scroll-mt-20 gap-6 lg:grid-cols-[1fr_1.6fr]"
          aria-labelledby="domande-titolo"
        >
          <div className="grid content-start gap-2">
            <h2 id="domande-titolo" className="text-2xl font-semibold sm:text-3xl">
              Domande frequenti
            </h2>
            <p className="text-muted-foreground">
              Altro da chiedere? Scrivi a{" "}
              <a
                href="mailto:info@christianprete.it"
                className="text-primary-text underline underline-offset-4"
              >
                info@christianprete.it
              </a>
              .
            </p>
          </div>
          <div className="grid gap-2">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-xl border bg-card/60 px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span
                    className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45"
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Invito finale */}
        <section className="relative overflow-hidden rounded-2xl border bg-card p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute inset-0 bg-aurora opacity-60" aria-hidden />
          <div className="relative mx-auto grid max-w-xl justify-items-center gap-4">
            <h2 className="text-2xl font-semibold text-balance sm:text-4xl">
              Il tuo primo video, questa settimana
            </h2>
            <p className="text-muted-foreground">
              Registrati, racconta la tua attività in 5 minuti e ricevi gli script da girare.
            </p>
            <Button variant="brand" size="lg" asChild>
              <Link href="/registrati">Prova gratis 3 video</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="relative border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} Christian Prete Agency · CPECOMGROUP di Prete Christian ·
            P.IVA IT03436340735
          </p>
          <nav aria-label="Note legali" className="flex gap-4">
            <Link href="/termini" className="hover:text-foreground">
              Termini
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/cookie" className="hover:text-foreground">
              Cookie
            </Link>
            <Link href="/trattamento-dati" className="hover:text-foreground">
              Trattamento dati
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Anteprima di un video verticale montato: sottotitolo in basso, stato "da approvare". */
function PhonePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[17rem]" aria-hidden>
      <div className="absolute -inset-10 rounded-full bg-nx-blue-500/20 blur-3xl" />
      <div className="relative aspect-[9/19] rounded-[2.4rem] border-[6px] border-[#1a2030] bg-[#0b0f18] p-2 shadow-2xl">
        <div className="relative h-full overflow-hidden rounded-[1.9rem] bg-[radial-gradient(120%_80%_at_50%_20%,#2a3550_0%,#121826_55%,#0a0d14_100%)]">
          <div className="absolute top-3 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-black/80" />
          <div className="absolute inset-x-0 top-[24%] mx-auto size-24 rounded-full bg-[#3a4560]" />
          <div className="absolute inset-x-6 top-[42%] h-40 rounded-t-[3rem] bg-[#2e3850]" />
          <p className="absolute inset-x-3 top-12 text-center text-[0.8rem] leading-tight font-bold text-white drop-shadow">
            3 errori che fanno <span className="text-nx-blue-300">scappare</span> i clienti
          </p>
          <p className="absolute inset-x-4 bottom-[22%] text-center text-[0.95rem] leading-tight font-extrabold text-white [text-shadow:0_2px_6px_rgb(0_0_0/0.8)]">
            il primo è <span className="text-[#ffd84d]">sbagliare</span> l&apos;orario
          </p>
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-black/55 px-3 py-2 text-[0.7rem] text-white backdrop-blur">
            <span className="font-semibold">Da approvare</span>
            <span className="rounded-md bg-nx-blue-500 px-2 py-1 font-semibold">Approva</span>
          </div>
        </div>
      </div>
    </div>
  );
}
