"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { generateLanding } from "@/app/admin/corsi/landing-actions";
import type { Brief } from "@/lib/landing/sections";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Label, Textarea } from "@/components/ui/input";

const TONI: { v: Brief["tono"]; label: string; hint: string }[] = [
  { v: "diretto", label: "Diretto", hint: "Frasi brevi, concreto" },
  { v: "rassicurante", label: "Rassicurante", hint: "Toglie le paure" },
  { v: "tecnico", label: "Tecnico", hint: "Preciso, per esperti" },
  { v: "energico", label: "Energico", hint: "Motivante, credibile" },
];

export function BriefForm({
  courseId,
  initial,
  usage,
  onDone,
}: {
  courseId: string;
  initial?: Partial<Brief>;
  usage: { usate: number; limite: number | null };
  onDone?: () => void;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const finite = usage.limite !== null;
  const esaurite = finite && usage.usate >= (usage.limite ?? 0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const brief = Object.fromEntries(
      ["pubblico", "problema", "risultato", "obiezioni", "bonus", "garanzia", "tono", "note"].map(
        (k) => [k, String(fd.get(k) ?? "")],
      ),
    );
    start(async () => {
      const r = await generateLanding(courseId, brief);
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setError(r.error);
        return;
      }
      setErrors({});
      setError(undefined);
      onDone?.();
      router.refresh();
    });
  }

  const area = (name: keyof Brief, label: string, hint: string, rows = 3) => (
    <Field id={`brief-${name}`} label={label} error={errors[name]} hint={hint}>
      {(a) => (
        <Textarea
          {...a}
          name={name}
          defaultValue={(initial?.[name] as string) ?? ""}
          style={{ minHeight: rows * 28 }}
        />
      )}
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {error && <Alert>{error}</Alert>}
      {area(
        "pubblico",
        "A chi si rivolge il corso?",
        "Es. freelance e professionisti al primo anno di partita IVA che hanno paura di sbagliare con le tasse.",
      )}
      {area(
        "problema",
        "Quale problema risolve?",
        "Cosa li fa stare male oggi, con le loro parole.",
      )}
      {area(
        "risultato",
        "Cosa sa fare chi lo finisce?",
        "Il risultato concreto, senza promesse impossibili.",
      )}
      {area(
        "obiezioni",
        "Cosa frena l'acquisto? (facoltativo)",
        "Es. «non ho tempo», «è troppo tecnico», «costa troppo».",
        2,
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {area(
          "bonus",
          "Bonus inclusi (facoltativo)",
          "Solo quelli veri: modelli, sessione live, gruppo… Se vuoto, l'IA non ne inventa.",
          2,
        )}
        {area(
          "garanzia",
          "Garanzia (facoltativo)",
          "Es. rimborso entro 14 giorni. Se vuoto, nessuna garanzia.",
          2,
        )}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Tono</legend>
        <div className="grid gap-2 sm:grid-cols-4">
          {TONI.map((t) => (
            <label
              key={t.v}
              className="flex min-h-11 cursor-pointer flex-col rounded-md border border-line p-3 has-[:checked]:border-nexora-blue has-[:checked]:bg-blue-tint"
            >
              <input
                type="radio"
                name="tono"
                value={t.v}
                defaultChecked={(initial?.tono ?? "diretto") === t.v}
                className="sr-only"
              />
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="text-xs text-ink-muted">{t.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {area(
        "note",
        "Altro da sapere (facoltativo)",
        "Parole da usare o evitare, cosa vi distingue, a chi NON è adatto.",
        2,
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={pending || esaurite}>
          <Sparkles aria-hidden /> {pending ? "L'IA sta scrivendo…" : "Genera la landing"}
        </Button>
        <p className="text-[13px] text-ink-muted" aria-live="polite">
          {pending
            ? "Ci vogliono 20-40 secondi. Non chiudere la pagina."
            : finite
              ? `${usage.usate} di ${usage.limite} generazioni usate questo mese.`
              : "Generazioni illimitate con il tuo piano."}
        </p>
      </div>
      <Label className="sr-only">Nota sulla generazione</Label>
    </form>
  );
}
