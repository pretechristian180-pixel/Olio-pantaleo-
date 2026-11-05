"use client";

import { ActionForm } from "@/components/forms/action-form";
import Link from "next/link";
import { useActionState } from "react";

import { FormMessage, type FormState } from "@/components/forms/form-message";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { signIn } from "../actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, null);
  return (
    <ActionForm action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field id="email" label="Email">
        {(p) => (
          <Input name="email" type="email" inputMode="email" autoComplete="email" required {...p} />
        )}
      </Field>
      <div className="grid gap-2">
        <Field id="password" label="Password">
          {(p) => <PasswordInput name="password" autoComplete="current-password" required {...p} />}
        </Field>
        <Link
          href="/password-dimenticata"
          className="justify-self-end text-sm font-medium text-primary-text underline-offset-4 hover:underline"
        >
          Password dimenticata?
        </Link>
      </div>
      <SubmitButton variant="brand" size="lg" pendingLabel="Accesso in corso…">
        Accedi
      </SubmitButton>
    </ActionForm>
  );
}
