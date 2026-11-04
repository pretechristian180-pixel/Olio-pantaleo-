"use client";

import { useActionState } from "react";
import { updateProfile, type ActionResult } from "@/app/app/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";

export function ProfileForm({
  nome,
  cognome,
  email,
  marketing,
}: {
  nome: string;
  cognome: string;
  email: string;
  marketing: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateProfile,
    null,
  );
  const fields = state && !state.ok ? (state.fields ?? {}) : {};
  return (
    <form action={action} className="flex max-w-140 flex-col gap-5">
      {state?.ok && <Alert tone="success">Dati salvati.</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="nome" label="Nome" error={fields.nome}>
          {(a) => <Input {...a} name="nome" defaultValue={nome} autoComplete="given-name" />}
        </Field>
        <Field id="cognome" label="Cognome" error={fields.cognome}>
          {(a) => <Input {...a} name="cognome" defaultValue={cognome} autoComplete="family-name" />}
        </Field>
      </div>
      <Field id="email" label="Email" hint="Per cambiarla scrivici: è legata ai tuoi acquisti.">
        {(a) => <Input {...a} value={email} readOnly disabled />}
      </Field>
      <Checkbox
        name="marketing"
        defaultChecked={marketing}
        label="Voglio ricevere via email consigli pratici e novità sui corsi Nexora"
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
    </form>
  );
}
