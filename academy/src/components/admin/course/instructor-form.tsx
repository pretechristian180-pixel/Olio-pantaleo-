"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { createInstructor, type FormState } from "@/app/admin/corsi/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

export function InstructorForm({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createInstructor, null);
  if (!open || state?.ok) {
    return (
      <div className="flex flex-col gap-3">
        {state?.ok && <Alert tone="success">{state.message}</Alert>}
        <div>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <UserPlus aria-hidden /> Aggiungi un docente
          </Button>
        </div>
      </div>
    );
  }
  const f = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="doc-nome" label="Nome e cognome" error={f.nome}>
          {(a) => <Input {...a} name="nome" autoFocus />}
        </Field>
        <Field
          id="doc-qualifica"
          label="Ruolo"
          error={f.qualifica}
          hint="Es. Commercialista, fondatrice dello studio"
        >
          {(a) => <Input {...a} name="qualifica" />}
        </Field>
      </div>
      <Field id="doc-bio" label="Presentazione" error={f.bio}>
        {(a) => <Textarea {...a} name="bio" className="min-h-24" />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva docente"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
