"use client";

import { ActionForm } from "@/components/forms/action-form";
import { SECTORS, type Tables } from "@nexora/shared";
import { useActionState } from "react";

import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { saveCompany } from "@/lib/actions/workspace";

export function CompanyForm({
  workspace,
  mode,
  readOnly = false,
  submitLabel = "Salva",
  footer,
}: {
  workspace: Pick<
    Tables<"workspaces">,
    "id" | "name" | "sector" | "city" | "website" | "instagram_handle"
  > | null;
  mode: "onboarding" | "settings";
  readOnly?: boolean;
  submitLabel?: string;
  footer?: React.ReactNode;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveCompany, null);
  const fe = state?.fieldErrors ?? {};

  return (
    <ActionForm action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="workspace_id" value={workspace?.id ?? ""} />
      <FormMessage state={state} />
      <fieldset disabled={readOnly} className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Nome dell'azienda" error={fe.name} className="sm:col-span-2">
          {(p) => (
            <Input name="name" defaultValue={workspace?.name} autoComplete="organization" {...p} />
          )}
        </Field>
        <Field id="sector" label="Settore" error={fe.sector}>
          {(p) => (
            <NativeSelect name="sector" defaultValue={workspace?.sector ?? ""} {...p}>
              <option value="" disabled>
                Scegli il settore
              </option>
              {SECTORS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="city" label="Città" error={fe.city}>
          {(p) => (
            <Input
              name="city"
              defaultValue={workspace?.city ?? ""}
              autoComplete="address-level2"
              {...p}
            />
          )}
        </Field>
        <Field id="website" label="Sito web" hint="Facoltativo." error={fe.website}>
          {(p) => (
            <Input
              name="website"
              defaultValue={workspace?.website ?? ""}
              inputMode="url"
              placeholder="www.tuaazienda.it"
              autoCapitalize="none"
              {...p}
            />
          )}
        </Field>
        <Field
          id="instagram"
          label="Instagram"
          hint="Facoltativo. Solo il nome utente."
          error={fe.instagram}
        >
          {(p) => (
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                name="instagram"
                defaultValue={workspace?.instagram_handle ?? ""}
                className="pl-8"
                autoCapitalize="none"
                autoCorrect="off"
                {...p}
              />
            </div>
          )}
        </Field>
      </fieldset>
      {!readOnly && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {footer ?? <span />}
          <SubmitButton
            variant={mode === "onboarding" ? "brand" : "default"}
            size="lg"
            pendingLabel="Salvataggio…"
          >
            {submitLabel}
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
