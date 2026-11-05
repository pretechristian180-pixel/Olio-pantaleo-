"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createCourse, type FormState } from "@/app/admin/corsi/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function NewCourseButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createCourse, null);
  if (!open) {
    return (
      <Button size="lg" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Nuovo corso
      </Button>
    );
  }
  const err = state && !state.ok ? (state.fields?.titolo ?? state.error) : undefined;
  return (
    <form
      action={action}
      className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-start"
    >
      <div className="sm:w-80">
        <Field id="titolo-nuovo" label="Titolo del corso" error={err}>
          {(a) => (
            <Input {...a} name="titolo" autoFocus placeholder="Es. Fisco semplice per freelance" />
          )}
        </Field>
      </div>
      <div className="flex gap-2 sm:pt-7">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creazione…" : "Crea"}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
