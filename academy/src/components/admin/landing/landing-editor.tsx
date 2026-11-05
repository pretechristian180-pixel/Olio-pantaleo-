"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ExternalLink,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  regenerateSection,
  saveLanding,
  setLandingStatus,
} from "@/app/admin/corsi/landing-actions";
import { SECTION_LABELS, type Brief, type RegenMode, type Section } from "@/lib/landing/sections";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { BriefForm } from "./brief-form";

const REGEN: { mode: RegenMode; label: string }[] = [
  { mode: "rigenera", label: "Rigenera" },
  { mode: "breve", label: "Più breve" },
  { mode: "diretto", label: "Più diretto" },
  { mode: "emozionale", label: "Più coinvolgente" },
];

type Field = {
  key: string;
  label: string;
  kind: "text" | "area" | "list" | "pairs";
  a?: string;
  b?: string;
};
const FIELDS: Record<Section["tipo"], Field[]> = {
  hero: [
    { key: "sopratitolo", label: "Sopratitolo", kind: "text" },
    { key: "titolo", label: "Titolo", kind: "text" },
    { key: "sottotitolo", label: "Sottotitolo", kind: "area" },
    { key: "cta", label: "Testo del pulsante", kind: "text" },
  ],
  problema: [
    { key: "titolo", label: "Titolo", kind: "text" },
    { key: "intro", label: "Introduzione", kind: "area" },
    { key: "punti", label: "Situazioni", kind: "list" },
  ],
  risultati: [
    { key: "titolo", label: "Titolo", kind: "text" },
    { key: "items", label: "Risultati", kind: "pairs", a: "titolo", b: "testo" },
  ],
  per_chi: [
    { key: "titolo", label: "Titolo", kind: "text" },
    { key: "si", label: "È per te se…", kind: "list" },
    { key: "no", label: "Non è per te se…", kind: "list" },
  ],
  programma: [
    { key: "titolo", label: "Titolo", kind: "text" },
    { key: "intro", label: "Introduzione (moduli e lezioni si aggiornano da soli)", kind: "area" },
  ],
  docente: [
    { key: "titolo", label: "Titolo (la scheda si prende dal docente del corso)", kind: "text" },
  ],
  bonus: [
    { key: "titolo", label: "Titolo", kind: "text" },
    { key: "items", label: "Bonus", kind: "pairs", a: "titolo", b: "testo" },
  ],
  garanzia: [
    { key: "titolo", label: "Titolo", kind: "text" },
    { key: "testo", label: "Testo", kind: "area" },
  ],
  faq: [
    { key: "titolo", label: "Titolo", kind: "text" },
    { key: "items", label: "Domande", kind: "pairs", a: "domanda", b: "risposta" },
  ],
  cta_finale: [
    { key: "titolo", label: "Titolo", kind: "text" },
    { key: "testo", label: "Testo", kind: "area" },
    { key: "cta", label: "Testo del pulsante", kind: "text" },
  ],
};

export function LandingEditor({
  courseId,
  courseSlug,
  stato,
  initial,
  brief,
  usage,
}: {
  courseId: string;
  courseSlug: string;
  stato: "draft" | "published";
  initial: Section[];
  brief: Partial<Brief>;
  usage: {
    landing: { usate: number; limite: number | null };
    sezioni: { usate: number; limite: number | null };
  };
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const [pending, start] = useTransition();

  const update = (id: string, dati: Record<string, unknown>) => {
    setSections((all) =>
      all.map((s) => (s.id === id ? ({ ...s, dati: { ...s.dati, ...dati } } as Section) : s)),
    );
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setSections((all) => {
      const j = i + d;
      if (j < 0 || j >= all.length) return all;
      const next = [...all];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    setDirty(true);
  };
  const toggle = (id: string) => {
    setSections((all) =>
      all.map((s) => (s.id === id ? ({ ...s, visibile: !s.visibile } as Section) : s)),
    );
    setDirty(true);
  };

  const save = (then?: () => Promise<unknown>) =>
    start(async () => {
      const r = await saveLanding(courseId, sections);
      if (!r.ok) return setMsg({ tone: "error", text: r.error });
      setDirty(false);
      if (then) await then();
      setMsg({ tone: "success", text: "Landing salvata." });
      router.refresh();
    });

  async function regen(s: Section, mode: RegenMode) {
    if (dirty) {
      const r = await saveLanding(courseId, sections);
      if (!r.ok) return setMsg({ tone: "error", text: r.error });
      setDirty(false);
    }
    setBusy(s.id);
    const r = await regenerateSection(courseId, s.id, mode);
    setBusy(null);
    if (!r.ok || !r.data) return setMsg({ tone: "error", text: r.ok ? "Riprova." : r.error });
    setSections((all) => all.map((x) => (x.id === s.id ? r.data! : x)));
    setMsg({ tone: "success", text: `«${SECTION_LABELS[s.tipo]}» riscritta.` });
  }

  const pubblicata = stato === "published";
  const sezLimite = usage.sezioni.limite;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {pubblicata ? (
              <Badge tone="positive">Pubblicata</Badge>
            ) : (
              <Badge tone="neutral">Bozza</Badge>
            )}
            <Link
              href={`/corsi/${courseSlug}?anteprima=1`}
              target="_blank"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-nexora-blue"
            >
              Anteprima <ExternalLink aria-hidden className="size-3.5" />
            </Link>
            <span className="text-[13px] text-ink-muted">
              Riscritture sezioni:{" "}
              {sezLimite === null
                ? "illimitate"
                : `${usage.sezioni.usate} di ${sezLimite} questo mese`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowBrief((v) => !v)}>
              <Sparkles aria-hidden /> Rigenera tutta
            </Button>
            <Button variant="secondary" disabled={!dirty || pending} onClick={() => save()}>
              {pending ? "Salvataggio…" : dirty ? "Salva modifiche" : "Salvata"}
            </Button>
            <Button
              disabled={pending}
              variant={pubblicata ? "secondary" : "primary"}
              onClick={() =>
                save(() => setLandingStatus(courseId, pubblicata ? "draft" : "published"))
              }
            >
              {pubblicata ? "Rimetti in bozza" : "Pubblica la landing"}
            </Button>
          </div>
        </CardBody>
      </Card>

      {showBrief && (
        <Card>
          <CardBody className="sm:p-8">
            <p className="mb-5 text-sm text-ink-muted">
              Modifica il brief e rigenera: tutte le sezioni vengono riscritte. Le modifiche fatte a
              mano si perdono.
            </p>
            <BriefForm
              courseId={courseId}
              initial={brief}
              usage={usage.landing}
              onDone={() => setShowBrief(false)}
            />
          </CardBody>
        </Card>
      )}

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <ol className="flex flex-col gap-4">
        {sections.map((s, i) => (
          <li key={s.id}>
            <Card className={s.visibile ? "" : "opacity-60"}>
              <CardBody>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="flex-1 font-semibold">
                    {SECTION_LABELS[s.tipo]}
                    {!s.visibile && (
                      <span className="ml-2 text-sm font-normal text-ink-muted">(nascosta)</span>
                    )}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Sposta su"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Sposta giù"
                    disabled={i === sections.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={s.visibile ? "Nascondi la sezione" : "Mostra la sezione"}
                    onClick={() => toggle(s.id)}
                  >
                    {s.visibile ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                  </Button>
                </div>
                <div className="mt-4 flex flex-col gap-4">
                  {FIELDS[s.tipo].map((f) => (
                    <FieldEditor
                      key={f.key}
                      f={f}
                      value={(s.dati as Record<string, unknown>)[f.key]}
                      onChange={(v) => update(s.id, { [f.key]: v })}
                    />
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <Wand2 aria-hidden className="size-4 text-nexora-blue" />
                  {REGEN.map((r) => (
                    <Button
                      key={r.mode}
                      variant="secondary"
                      disabled={busy !== null || pending}
                      onClick={() => regen(s, r.mode)}
                    >
                      {r.label}
                    </Button>
                  ))}
                  {busy === s.id && (
                    <span className="text-[13px] text-ink-muted" aria-live="polite">
                      L&apos;IA sta riscrivendo…
                    </span>
                  )}
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FieldEditor({
  f,
  value,
  onChange,
}: {
  f: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `f-${f.key}-${Math.random().toString(36).slice(2, 6)}`;
  if (f.kind === "text" || f.kind === "area") {
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold">
          {f.label}
        </label>
        {f.kind === "text" ? (
          <Input
            id={id}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="h-11"
          />
        ) : (
          <Textarea
            id={id}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-20"
          />
        )}
      </div>
    );
  }
  if (f.kind === "list") {
    const items = (value as string[]) ?? [];
    return (
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">{f.label}</legend>
        <div className="flex flex-col gap-2">
          {items.map((x, i) => (
            <div key={i} className="flex gap-2">
              <Input
                aria-label={`${f.label} ${i + 1}`}
                value={x}
                onChange={(e) => onChange(items.map((y, j) => (j === i ? e.target.value : y)))}
                className="h-11"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Elimina voce ${i + 1}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          <div>
            <Button variant="ghost" onClick={() => onChange([...items, ""])}>
              <Plus aria-hidden /> Aggiungi
            </Button>
          </div>
        </div>
      </fieldset>
    );
  }
  const items = (value as Record<string, string>[]) ?? [];
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold">{f.label}</legend>
      <div className="flex flex-col gap-3">
        {items.map((x, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-md bg-surface-alt p-3 sm:grid-cols-[1fr_2fr_auto]"
          >
            <Input
              aria-label={`${f.a} ${i + 1}`}
              value={x[f.a!] ?? ""}
              onChange={(e) =>
                onChange(items.map((y, j) => (j === i ? { ...y, [f.a!]: e.target.value } : y)))
              }
              className="h-11"
            />
            <Textarea
              aria-label={`${f.b} ${i + 1}`}
              value={x[f.b!] ?? ""}
              onChange={(e) =>
                onChange(items.map((y, j) => (j === i ? { ...y, [f.b!]: e.target.value } : y)))
              }
              className="min-h-11"
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Elimina voce ${i + 1}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <div>
          <Button variant="ghost" onClick={() => onChange([...items, { [f.a!]: "", [f.b!]: "" }])}>
            <Plus aria-hidden /> Aggiungi
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
