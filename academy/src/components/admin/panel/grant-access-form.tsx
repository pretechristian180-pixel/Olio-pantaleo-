"use client";

import { useActionState, useEffect, useRef } from "react";
import { grantAccess, type ActionState } from "@/app/admin/panel-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/** Dai accesso a un corso a una persona già registrata (bonifico, omaggio, azienda). */
export function GrantAccessForm({ courses }: { courses: { id: string; titolo: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(grantAccess, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  if (!courses.length)
    return <p className="text-sm text-ink-muted">Crea prima un corso per poter dare accesso.</p>;
  return (
    <form ref={form} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="ga-email">Email della persona</Label>
          <Input id="ga-email" name="email" type="email" required placeholder="nome@azienda.it" />
        </div>
        <div>
          <Label htmlFor="ga-corso">Corso</Label>
          <select
            id="ga-corso"
            name="course_id"
            required
            className="h-13 w-full rounded-md border border-line bg-surface px-3 text-[15px] focus:border-nexora-blue focus:outline-none"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titolo}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Un attimo…" : "Dai accesso"}
        </Button>
      </div>
      {state && (
        <Alert tone={state.ok ? "success" : "error"}>
          {state.ok ? state.message : state.error}
        </Alert>
      )}
    </form>
  );
}
