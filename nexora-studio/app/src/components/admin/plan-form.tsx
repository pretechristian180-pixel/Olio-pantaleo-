"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { type AdminActionResult, updatePlanAction } from "@/lib/actions/admin";

type Plan = {
  id: string;
  name: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  videos_per_month: number;
  social_accounts_max: number;
  broll_credits_month: number;
  brands_max: number;
  active: boolean;
};

const FIELDS: [keyof Plan, string, string?][] = [
  ["price_monthly_cents", "Prezzo mensile", "centesimi"],
  ["price_yearly_cents", "Prezzo annuale", "centesimi"],
  ["videos_per_month", "Video al mese", "per brand"],
  ["social_accounts_max", "Social", "per brand"],
  ["broll_credits_month", "Clip b-roll al mese", "per brand"],
  ["brands_max", "Brand"],
];

/** Modifica di un piano: limiti e prezzi di listino. */
export function PlanForm({ plan }: { plan: Plan }) {
  const [state, action] = useActionState<AdminActionResult | null, FormData>(
    updatePlanAction,
    null,
  );
  return (
    <ActionForm action={action} className="grid gap-4 rounded-2xl border bg-card p-5">
      <input type="hidden" name="plan_id" value={plan.id} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={plan.active}
            className="size-4 accent-[var(--primary)]"
          />
          In vendita
        </label>
      </div>
      <FormMessage state={state ? { error: state.error, success: state.message } : null} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FIELDS.map(([key, label, hint]) => (
          <label key={key} className="grid gap-1 text-sm">
            <span className="font-medium">{label}</span>
            <Input
              name={key}
              type="number"
              min={key === "brands_max" ? 1 : 0}
              step={1}
              required
              defaultValue={plan[key] as number}
              inputMode="numeric"
            />
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          </label>
        ))}
      </div>
      <SubmitButton className="justify-self-start" pendingLabel="Salvataggio…">
        Salva {plan.name}
      </SubmitButton>
    </ActionForm>
  );
}
