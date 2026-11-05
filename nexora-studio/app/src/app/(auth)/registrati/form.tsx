"use client";

import { ActionForm } from "@/components/forms/action-form";
import Link from "next/link";
import { useActionState } from "react";

import { FormMessage, type FormState } from "@/components/forms/form-message";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { signUp } from "../actions";

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signUp, null);
  const fe = state?.fieldErrors ?? {};

  if (state?.success) {
    return (
      <div className="grid gap-4">
        <FormMessage state={state} />
        <p className="text-sm text-muted-foreground">
          Non trovi l&apos;email? Controlla nella posta indesiderata o nella scheda
          &quot;Promozioni&quot;.
        </p>
      </div>
    );
  }

  return (
    <ActionForm action={action} className="grid gap-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage state={state} />
      <Field id="full_name" label="Nome e cognome" error={fe.full_name}>
        {(p) => <Input name="full_name" autoComplete="name" required {...p} />}
      </Field>
      <Field id="email" label="Email" error={fe.email}>
        {(p) => (
          <Input name="email" type="email" inputMode="email" autoComplete="email" required {...p} />
        )}
      </Field>
      <Field
        id="password"
        label="Password"
        hint="Almeno 8 caratteri, con lettere e numeri."
        error={fe.password}
      >
        {(p) => <PasswordInput name="password" autoComplete="new-password" required {...p} />}
      </Field>
      <div className="grid gap-2">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="terms"
            className="mt-0.5 size-5 shrink-0 rounded accent-[var(--nx-blue-500)]"
            aria-invalid={fe.terms ? true : undefined}
            aria-describedby={fe.terms ? "terms-error" : undefined}
          />
          <span className="text-muted-foreground">
            Accetto i{" "}
            <Link
              href="/termini"
              className="font-medium text-primary-text underline-offset-4 hover:underline"
            >
              termini del servizio
            </Link>{" "}
            e ho letto l&apos;
            <Link
              href="/privacy"
              className="font-medium text-primary-text underline-offset-4 hover:underline"
            >
              informativa privacy
            </Link>
            .
          </span>
        </label>
        {fe.terms && (
          <p
            id="terms-error"
            role="alert"
            className="text-[0.8125rem] font-medium text-destructive"
          >
            {fe.terms}
          </p>
        )}
      </div>
      <SubmitButton variant="brand" size="lg" pendingLabel="Creo l'account…">
        Crea l&apos;account
      </SubmitButton>
    </ActionForm>
  );
}
