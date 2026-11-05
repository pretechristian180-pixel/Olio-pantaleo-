"use client";

import { ActionForm } from "@/components/forms/action-form";
import { useActionState } from "react";

import { FormMessage, type FormState } from "@/components/forms/form-message";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";

import { updatePassword } from "../actions";

export default function ReimpostaPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, null);
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Scegli una nuova password</h1>
        <p className="text-muted-foreground">
          Dopo il salvataggio entri direttamente nell&apos;app.
        </p>
      </div>
      <ActionForm action={action} className="grid gap-5" noValidate>
        <FormMessage state={state} />
        <Field
          id="password"
          label="Nuova password"
          hint="Almeno 8 caratteri, con lettere e numeri."
          error={state?.fieldErrors?.password}
        >
          {(p) => <PasswordInput name="password" autoComplete="new-password" required {...p} />}
        </Field>
        <SubmitButton variant="brand" size="lg" pendingLabel="Salvataggio…">
          Salva la password
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
