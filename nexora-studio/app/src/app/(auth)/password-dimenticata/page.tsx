"use client";

import { ActionForm } from "@/components/forms/action-form";
import Link from "next/link";
import { useActionState } from "react";

import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { requestPasswordReset } from "../actions";

export default function PasswordDimenticataPage() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, null);
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Password dimenticata</h1>
        <p className="text-muted-foreground">
          Scrivi la tua email: ti mandiamo un link per sceglierne una nuova.
        </p>
      </div>
      {state?.success ? (
        <FormMessage state={state} />
      ) : (
        <ActionForm action={action} className="grid gap-5" noValidate>
          <FormMessage state={state} />
          <Field id="email" label="Email" error={state?.fieldErrors?.email}>
            {(p) => (
              <Input
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                {...p}
              />
            )}
          </Field>
          <SubmitButton variant="brand" size="lg" pendingLabel="Invio in corso…">
            Mandami il link
          </SubmitButton>
        </ActionForm>
      )}
      <Link
        href="/accedi"
        className="text-center text-sm font-semibold text-primary-text underline-offset-4 hover:underline"
      >
        Torna all&apos;accesso
      </Link>
    </div>
  );
}
