"use client";

import { ActionForm } from "@/components/forms/action-form";
import { useActionState } from "react";

import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/lib/actions/team";

export function ProfileForm({
  fullName,
  phone,
  email,
}: {
  fullName: string;
  phone: string;
  email: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, null);
  return (
    <ActionForm action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label="Nome e cognome" error={state?.fieldErrors?.full_name}>
          {(p) => <Input name="full_name" defaultValue={fullName} autoComplete="name" {...p} />}
        </Field>
        <Field
          id="phone"
          label="Telefono"
          hint="Facoltativo. Servirà per gli avvisi su WhatsApp."
          error={state?.fieldErrors?.phone}
        >
          {(p) => (
            <Input
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={phone}
              autoComplete="tel"
              {...p}
            />
          )}
        </Field>
        <Field id="email-ro" label="Email" className="sm:col-span-2">
          {(p) => <Input value={email} readOnly disabled {...p} />}
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Salvataggio…">Salva il profilo</SubmitButton>
      </div>
    </ActionForm>
  );
}
