"use client";

import { ActionForm } from "@/components/forms/action-form";
import { WEEKDAYS, type Tables } from "@nexora/shared";
import { useActionState, useState } from "react";

import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Choice, ChoiceGroup } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { savePublishing } from "@/lib/actions/workspace";
import { DEFAULT_DAYS } from "@/lib/onboarding";

const FREQUENCIES = [
  { value: 2, label: "2 a settimana", description: "Per iniziare con calma" },
  { value: 3, label: "3 a settimana", description: "Il ritmo consigliato" },
  { value: 4, label: "4 a settimana", description: "Per crescere più in fretta" },
];

export function PublishingForm({
  workspace,
  mode,
  readOnly = false,
  submitLabel = "Salva",
  footer,
}: {
  workspace: Pick<Tables<"workspaces">, "id" | "posts_per_week" | "posting_days" | "posting_time">;
  mode: "onboarding" | "settings";
  readOnly?: boolean;
  submitLabel?: string;
  footer?: React.ReactNode;
}) {
  const [state, action] = useActionState<FormState, FormData>(savePublishing, null);
  const fe = state?.fieldErrors ?? {};
  const [perWeek, setPerWeek] = useState(workspace.posts_per_week);
  const [days, setDays] = useState<number[]>(workspace.posting_days);

  function changeFrequency(n: number) {
    setPerWeek(n);
    setDays(DEFAULT_DAYS[n] ?? []);
  }

  function toggleDay(d: number, checked: boolean) {
    setDays((ds) => (checked ? [...ds, d].sort() : ds.filter((x) => x !== d)));
  }

  return (
    <ActionForm action={action} className="grid gap-7" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="workspace_id" value={workspace.id} />
      <FormMessage state={state} />
      <fieldset disabled={readOnly} className="grid gap-7">
        <ChoiceGroup
          id="posts_per_week"
          legend="Quanti video vuoi pubblicare?"
          error={fe.posts_per_week}
          className="grid sm:grid-cols-3"
        >
          {FREQUENCIES.map((f) => (
            <Choice
              key={f.value}
              type="radio"
              name="posts_per_week"
              value={f.value}
              label={f.label}
              description={f.description}
              checked={perWeek === f.value}
              onChange={() => changeFrequency(f.value)}
              className="min-h-16"
            />
          ))}
        </ChoiceGroup>

        <ChoiceGroup
          id="posting_days"
          legend="In quali giorni?"
          hint={`Scegli ${perWeek} giorni (selezionati ${days.length}).`}
          error={fe.posting_days}
          className="grid grid-cols-4 sm:grid-cols-7"
        >
          {WEEKDAYS.map((d) => (
            <Choice
              key={d.value}
              type="checkbox"
              name="posting_days"
              value={d.value}
              label={d.short}
              aria-label={d.label}
              checked={days.includes(d.value)}
              disabled={!days.includes(d.value) && days.length >= perWeek}
              onChange={(e) => toggleDay(d.value, e.target.checked)}
              className="items-center px-2"
            />
          ))}
        </ChoiceGroup>

        <Field
          id="posting_time"
          label="A che ora?"
          hint="Ora italiana. Potrai spostare ogni post dal calendario."
          error={fe.posting_time}
          className="max-w-48"
        >
          {(p) => (
            <Input
              type="time"
              name="posting_time"
              step={900}
              defaultValue={workspace.posting_time.slice(0, 5)}
              {...p}
            />
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
