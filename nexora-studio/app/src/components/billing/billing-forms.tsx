"use client";

import { CreditCard, Plus } from "lucide-react";
import { useActionState, useEffect } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  type BillingFormState,
  choosePlanAction,
  createBrandAction,
  openBillingPortalAction,
} from "@/lib/actions/billing";

/** Pagamento e portale sono pagine esterne (Stripe): navigazione completa del browser. */
function useExternalRedirect(state: BillingFormState) {
  useEffect(() => {
    if (state?.redirect) window.location.assign(state.redirect);
  }, [state]);
}

/** Pulsante "Scegli" di una scheda piano (pagamento o cambio piano). */
export function ChoosePlanForm({
  workspaceId,
  planId,
  interval,
  label,
  variant = "brand",
}: {
  workspaceId: string;
  planId: string;
  interval: "month" | "year";
  label: string;
  variant?: "brand" | "outline";
}) {
  const [state, action] = useActionState<BillingFormState, FormData>(choosePlanAction, null);
  useExternalRedirect(state);
  return (
    <ActionForm action={action} className="grid gap-3">
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="interval" value={interval} />
      <FormMessage state={state} />
      <SubmitButton variant={variant} size="lg" className="w-full" pendingLabel="Un attimo…">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

/** Portale dei pagamenti: carta, fatture, disdetta. */
export function PortalForm({
  workspaceId,
  label = "Pagamento e fatture",
}: {
  workspaceId: string;
  label?: string;
}) {
  const [state, action] = useActionState<BillingFormState, FormData>(openBillingPortalAction, null);
  useExternalRedirect(state);
  return (
    <ActionForm action={action} className="grid gap-3">
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingLabel="Apertura…">
        <CreditCard aria-hidden /> {label}
      </SubmitButton>
    </ActionForm>
  );
}

/** Nuovo brand coperto dall'abbonamento. */
export function AddBrandForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState<FormState, FormData>(createBrandAction, null);
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <Field id="brand_name" label="Nome del nuovo brand" error={state?.fieldErrors?.name}>
        {(p) => (
          <Input name="name" maxLength={120} placeholder="Es. Pizzeria Da Mario — Centro" {...p} />
        )}
      </Field>
      <SubmitButton pendingLabel="Creazione…">
        <Plus aria-hidden /> Aggiungi brand
      </SubmitButton>
    </ActionForm>
  );
}
