"use client";

import { useActionState, useTransition } from "react";
import { deleteLesson, updateLesson, type FormState } from "@/app/admin/corsi/actions";
import type { AdminLessonDetail } from "@/lib/data/admin";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";

export function LessonForm({ lesson }: { lesson: AdminLessonDetail }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateLesson, null);
  const f = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.ok && <Alert tone="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <input type="hidden" name="id" value={lesson.id} />
      <input type="hidden" name="courseId" value={lesson.course_id} />
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field id="titolo" label="Titolo della lezione" error={f.titolo}>
          {(a) => <Input {...a} name="titolo" defaultValue={lesson.titolo} />}
        </Field>
        <Field id="slug" label="Indirizzo" error={f.slug}>
          {(a) => <Input {...a} name="slug" defaultValue={lesson.slug} />}
        </Field>
      </div>
      <Field
        id="descrizione"
        label="Descrizione"
        error={f.descrizione}
        hint="La leggono gli studenti nella scheda Descrizione, sotto il video."
      >
        {(a) => <Textarea {...a} name="descrizione" defaultValue={lesson.descrizione ?? ""} />}
      </Field>
      <Checkbox
        name="is_free_preview"
        defaultChecked={lesson.is_free_preview}
        label="Anteprima gratuita: la può guardare chiunque si registri, anche senza acquistare il corso"
      />
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva la lezione"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteLesson({
  courseId,
  lessonId,
  titolo,
}: {
  courseId: string;
  lessonId: string;
  titolo: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={() =>
        window.confirm(`Eliminare la lezione «${titolo}» con video e materiali?`) &&
        start(async () => void (await deleteLesson(courseId, lessonId)))
      }
    >
      {pending ? "Eliminazione…" : "Elimina la lezione"}
    </Button>
  );
}
