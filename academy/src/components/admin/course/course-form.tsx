"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { updateCourse, type FormState } from "@/app/admin/corsi/actions";
import type { AdminCourseDetail, Instructor } from "@/lib/data/admin";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";

export function CourseForm({
  course,
  instructors,
}: {
  course: AdminCourseDetail;
  instructors: Instructor[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCourse, null);
  const [risultati, setRisultati] = useState(
    course.risultati.length ? course.risultati : [{ titolo: "", testo: "" }],
  );
  const f = state && !state.ok ? (state.fields ?? {}) : {};
  const set = (i: number, k: "titolo" | "testo", v: string) =>
    setRisultati((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.ok && <Alert tone="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <input type="hidden" name="id" value={course.id} />
      <input type="hidden" name="risultati" value={JSON.stringify(risultati)} />
      <Field id="titolo" label="Titolo" error={f.titolo}>
        {(a) => <Input {...a} name="titolo" defaultValue={course.titolo} />}
      </Field>
      <Field
        id="sottotitolo"
        label="Promessa (sottotitolo)"
        error={f.sottotitolo}
        hint="Una o due frasi: cosa ottiene chi segue il corso."
      >
        {(a) => (
          <Textarea
            {...a}
            name="sottotitolo"
            defaultValue={course.sottotitolo ?? ""}
            className="min-h-20"
            maxLength={300}
          />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          id="prezzo"
          label="Prezzo finale (€)"
          error={f.prezzo}
          hint="0 = corso gratuito."
        >
          {(a) => (
            <Input
              {...a}
              name="prezzo"
              inputMode="decimal"
              defaultValue={(course.prezzo_cents / 100).toString().replace(".", ",")}
            />
          )}
        </Field>
        <Field
          id="categoria"
          label="Categoria"
          error={f.categoria}
          hint="Es. Fisco e amministrazione."
        >
          {(a) => (
            <Input {...a} name="categoria" defaultValue={course.categoria ?? ""} maxLength={60} />
          )}
        </Field>
        <Field
          id="slug"
          label="Indirizzo della pagina"
          error={f.slug}
          hint={`/corsi/${course.slug}`}
        >
          {(a) => <Input {...a} name="slug" defaultValue={course.slug} />}
        </Field>
      </div>
      <div>
        <Label htmlFor="docente_id">Docente</Label>
        <select
          id="docente_id"
          name="docente_id"
          defaultValue={course.docente_id ?? ""}
          className="h-13 w-full rounded-md border border-line bg-surface px-4 text-[15px] focus:border-nexora-blue focus:outline-none"
        >
          <option value="">Nessun docente indicato</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
              {i.qualifica ? ` · ${i.qualifica}` : ""}
            </option>
          ))}
        </select>
      </div>
      <Field id="descrizione" label="Descrizione" error={f.descrizione}>
        {(a) => <Textarea {...a} name="descrizione" defaultValue={course.descrizione ?? ""} />}
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">Cosa porti a casa</legend>
        {risultati.map((r, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-md bg-surface-alt p-3 sm:grid-cols-[1fr_2fr_auto]"
          >
            <Input
              aria-label={`Risultato ${i + 1}: titolo`}
              placeholder="Es. Fatture senza errori"
              value={r.titolo}
              onChange={(e) => set(i, "titolo", e.target.value)}
              maxLength={80}
            />
            <Input
              aria-label={`Risultato ${i + 1}: descrizione`}
              placeholder="Una frase concreta"
              value={r.testo}
              onChange={(e) => set(i, "testo", e.target.value)}
              maxLength={300}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Elimina il risultato ${i + 1}`}
              onClick={() => setRisultati((x) => x.filter((_, j) => j !== i))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        {risultati.length < 8 && (
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRisultati((x) => [...x, { titolo: "", testo: "" }])}
            >
              <Plus aria-hidden /> Aggiungi un risultato
            </Button>
          </div>
        )}
      </fieldset>
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva il corso"}
        </Button>
      </div>
    </form>
  );
}
