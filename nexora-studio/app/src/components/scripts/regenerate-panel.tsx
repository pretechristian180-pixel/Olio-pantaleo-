"use client";

import { RefreshCw, X } from "lucide-react";
import { useActionState, useState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { regenerateScriptAction } from "@/lib/actions/scripts";

/** "Riscrivi questo script": pannello con motivo facoltativo e contatore delle riscritture. */
export function RegeneratePanel({ scriptId, remaining }: { scriptId: string; remaining: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await regenerateScriptAction(prev, fd);
    if (res?.success) setOpen(false);
    return res;
  }, null);

  if (remaining <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Hai usato le {3} riscritture di questa settimana. Se lo script non ti convince, segnalo come
        saltato.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="grid gap-2">
        {state?.success && <FormMessage state={state} />}
        <Button variant="outline" size="lg" onClick={() => setOpen(true)} aria-expanded={false}>
          <RefreshCw aria-hidden /> Riscrivi questo script
        </Button>
      </div>
    );
  }

  return (
    <div
      className="grid gap-4 rounded-xl border bg-card p-4"
      role="region"
      aria-label="Riscrivi lo script"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="font-display font-semibold">Riscrivi questo script</p>
          <p className="text-sm text-muted-foreground">
            Ne scriviamo uno nuovo su un altro tema. Ti restano {remaining}{" "}
            {remaining === 1 ? "riscrittura" : "riscritture"} questa settimana.
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Chiudi">
          <X aria-hidden />
        </Button>
      </div>
      <ActionForm action={action} className="grid gap-4">
        <input type="hidden" name="script_id" value={scriptId} />
        <FormMessage state={state?.error ? state : null} />
        <Field
          id="feedback"
          label="Cosa non ti convince?"
          hint="Facoltativo. Es. 'troppo tecnico', 'non voglio parlare di prezzi', 'preferisco un tutorial'."
        >
          {(p) => <Textarea name="feedback" rows={2} maxLength={600} {...p} />}
        </Field>
        <SubmitButton variant="brand" size="lg" pendingLabel="Sto scrivendo il nuovo script…">
          Riscrivi
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
