import { Check, ChevronDown, Gift, ShieldCheck, X } from "lucide-react";
import type { Course } from "@/lib/data/courses";
import type { Section, SectionDataMap } from "@/lib/landing/sections";
import { formatDuration, pluralize } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Button } from "@/components/ui/button";
import { CourseProgram } from "@/components/course/course-program";
import { InstructorCard } from "@/components/course/instructor-card";

type Props = {
  course: Course;
  sections: Section[];
  /** La card d'acquisto (con lo stato iscritto / lezione gratis) la passa la pagina. */
  purchase: React.ReactNode;
};

const wrap = "mx-auto max-w-310 px-4 sm:px-6";

/** Landing di vendita a sezioni: testi dall'IA o dal titolare, grafica della piattaforma. */
export function LandingView({ course, sections, purchase }: Props) {
  const visibili = sections.filter((s) => s.visibile);
  return (
    <>
      {visibili.map((s) => (
        <SectionView key={s.id} s={s} course={course} purchase={purchase} />
      ))}
    </>
  );
}

function Cta({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <Button asChild size="lg" variant={dark ? "inverse" : "primary"}>
      <a href="#acquista">{label || "Acquista il corso"}</a>
    </Button>
  );
}

function SectionView({
  s,
  course,
  purchase,
}: {
  s: Section;
  course: Course;
  purchase: React.ReactNode;
}) {
  switch (s.tipo) {
    case "hero":
      return <Hero d={s.dati} course={course} purchase={purchase} />;
    case "problema":
      return (
        <section className="bg-surface py-16 sm:py-20">
          <div className={`${wrap} max-w-3xl`}>
            <h2 className="text-[28px] leading-tight font-bold sm:text-[34px]">{s.dati.titolo}</h2>
            {s.dati.intro && <p className="mt-4 text-lg text-ink-muted">{s.dati.intro}</p>}
            <ul className="mt-8 flex flex-col gap-3">
              {s.dati.punti.map((p) => (
                <li
                  key={p}
                  className="flex gap-3 rounded-lg bg-surface-alt p-4 text-[15px] leading-6"
                >
                  <X aria-hidden className="mt-0.5 size-5 shrink-0 text-negative" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    case "risultati":
      return (
        <section className="bg-surface-alt py-16 sm:py-20">
          <div className={wrap}>
            <Eyebrow>Cosa porti a casa</Eyebrow>
            <h2 className="mt-3 max-w-3xl text-[28px] leading-tight font-bold sm:text-[34px]">
              {s.dati.titolo}
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {s.dati.items.map((r) => (
                <li key={r.titolo} className="rounded-lg border border-line bg-surface p-6">
                  <Check aria-hidden className="size-6 text-nexora-blue-bright" />
                  <h3 className="mt-3 font-bold">{r.titolo}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">{r.testo}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    case "per_chi":
      return <PerChi d={s.dati} />;
    case "programma":
      return (
        <section className="bg-surface py-16 sm:py-20">
          <div className={`${wrap} max-w-4xl`}>
            <h2 className="text-[28px] leading-tight font-bold sm:text-[34px]">
              {s.dati.titolo || "Il programma"}
            </h2>
            {s.dati.intro && <p className="mt-3 text-lg text-ink-muted">{s.dati.intro}</p>}
            <p className="mt-3 text-sm text-ink-muted">
              {pluralize(course.outline.moduli.length, "modulo", "moduli")} ·{" "}
              {pluralize(course.outline.totaleLezioni, "lezione", "lezioni")} ·{" "}
              {formatDuration(course.outline.totaleDurataSec)}
            </p>
            <div className="mt-8">
              <CourseProgram outline={course.outline} />
            </div>
          </div>
        </section>
      );
    case "docente":
      if (!course.docente) return null;
      return (
        <section className="bg-surface-alt py-16 sm:py-20">
          <div className={`${wrap} max-w-3xl`}>
            <h2 className="mb-6 text-[28px] leading-tight font-bold">
              {s.dati.titolo || "Chi ti accompagna"}
            </h2>
            <InstructorCard nome={course.docente.nome} bio={course.docente.bio} />
          </div>
        </section>
      );
    case "bonus":
      return (
        <section className="bg-surface py-16 sm:py-20">
          <div className={`${wrap} max-w-4xl`}>
            <h2 className="text-[28px] leading-tight font-bold sm:text-[34px]">{s.dati.titolo}</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {s.dati.items.map((b) => (
                <li key={b.titolo} className="flex gap-4 rounded-lg bg-blue-tint p-6">
                  <Gift aria-hidden className="size-6 shrink-0 text-nexora-blue-bright" />
                  <div>
                    <h3 className="font-bold">{b.titolo}</h3>
                    <p className="mt-1 text-sm leading-6">{b.testo}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    case "garanzia":
      return (
        <section className="bg-surface py-12">
          <div className={`${wrap} max-w-3xl`}>
            <div className="flex flex-col gap-4 rounded-lg border-2 border-positive p-6 sm:flex-row sm:items-center sm:p-8">
              <ShieldCheck aria-hidden className="size-12 shrink-0 text-positive" />
              <div>
                <h2 className="text-xl font-bold">{s.dati.titolo}</h2>
                <p className="mt-2 text-[15px] leading-6">{s.dati.testo}</p>
              </div>
            </div>
          </div>
        </section>
      );
    case "faq":
      return (
        <section className="bg-surface-alt py-16 sm:py-20">
          <div className={`${wrap} max-w-3xl`}>
            <h2 className="text-[28px] leading-tight font-bold sm:text-[34px]">
              {s.dati.titolo || "Domande frequenti"}
            </h2>
            <div className="mt-8 overflow-hidden rounded-lg border border-line bg-surface">
              {s.dati.items.map((f) => (
                <details key={f.domanda} className="group border-b border-line last:border-0">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 px-6 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{f.domanda}</span>
                    <ChevronDown
                      aria-hidden
                      className="size-5 shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="px-6 pb-5 text-[15px] leading-6 text-ink-muted">{f.risposta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    case "cta_finale":
      return (
        <section className="bg-graphite-deep py-16 text-white sm:py-20">
          <div className={`${wrap} max-w-3xl text-center`}>
            <h2 className="text-[28px] leading-tight font-bold sm:text-[36px]">{s.dati.titolo}</h2>
            {s.dati.testo && <p className="mt-4 text-lg text-white/80">{s.dati.testo}</p>}
            <div className="mt-8">
              <Cta label={s.dati.cta} dark />
            </div>
          </div>
        </section>
      );
  }
}

function Hero({
  d,
  course,
  purchase,
}: {
  d: SectionDataMap["hero"];
  course: Course;
  purchase: React.ReactNode;
}) {
  return (
    <section className="bg-graphite-deep text-white">
      <div className={`${wrap} grid gap-10 py-14 lg:grid-cols-[1fr_340px] lg:gap-16 lg:py-20`}>
        <div className="flex flex-col justify-center">
          {d.sopratitolo && <Eyebrow tone="bright">{d.sopratitolo}</Eyebrow>}
          <h1 className="mt-5 text-4xl leading-tight font-bold sm:text-5xl">
            {d.titolo || course.titolo}
          </h1>
          {d.sottotitolo && (
            <p className="mt-6 max-w-155 text-lg leading-7 text-ink-inverse-muted">
              {d.sottotitolo}
            </p>
          )}
          <div className="mt-8">
            <Cta label={d.cta} />
          </div>
        </div>
        <div id="acquista" className="scroll-mt-6">
          {purchase}
        </div>
      </div>
    </section>
  );
}

function PerChi({ d }: { d: SectionDataMap["per_chi"] }) {
  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className={`${wrap} max-w-4xl`}>
        <h2 className="text-[28px] leading-tight font-bold sm:text-[34px]">
          {d.titolo || "Per chi è questo corso"}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <ul className="flex flex-col gap-3 rounded-lg bg-positive-tint p-6">
            <li className="font-bold text-positive-deep">È per te se…</li>
            {d.si.map((x) => (
              <li key={x} className="flex gap-3 text-[15px] leading-6">
                <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-positive" />
                {x}
              </li>
            ))}
          </ul>
          {d.no.length > 0 && (
            <ul className="flex flex-col gap-3 rounded-lg bg-surface-alt p-6">
              <li className="font-bold">Non è per te se…</li>
              {d.no.map((x) => (
                <li key={x} className="flex gap-3 text-[15px] leading-6">
                  <X aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-muted" />
                  {x}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
