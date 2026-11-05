"use client";

import Link from "next/link";
import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { FormMessage, type FormState } from "@/components/forms/form-message";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { VEXATIOUS_CLAUSES } from "@/components/legal/legal";
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
      <div className="grid gap-3">
        <Consent name="terms" error={fe.terms}>
          Agisco per la mia attività (impresa o professionista con partita IVA), accetto i{" "}
          <Link
            href="/termini"
            target="_blank"
            className="font-medium text-primary-text underline-offset-4 hover:underline"
          >
            termini del servizio
          </Link>{" "}
          e l&apos;
          <Link
            href="/trattamento-dati"
            target="_blank"
            className="font-medium text-primary-text underline-offset-4 hover:underline"
          >
            accordo sul trattamento dei dati
          </Link>
          , e ho letto l&apos;
          <Link
            href="/privacy"
            target="_blank"
            className="font-medium text-primary-text underline-offset-4 hover:underline"
          >
            informativa privacy
          </Link>
          .
        </Consent>
        <Consent name="clauses" error={fe.clauses}>
          Approvo specificamente, ai sensi degli artt. 1341 e 1342 c.c., le clausole dei termini:{" "}
          <span className="text-xs">{VEXATIOUS_CLAUSES}.</span>
        </Consent>
      </div>
      <SubmitButton variant="brand" size="lg" pendingLabel="Creo l'account…">
        Crea l&apos;account
      </SubmitButton>
    </ActionForm>
  );
}

/** Casella di consenso con errore collegato per i lettori di schermo. */
function Consent({
  name,
  error,
  children,
}: {
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name={name}
          className="mt-0.5 size-5 shrink-0 rounded accent-[var(--nx-blue-500)]"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <span className="text-muted-foreground">{children}</span>
      </label>
      {error && (
        <p
          id={`${name}-error`}
          role="alert"
          className="text-[0.8125rem] font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
