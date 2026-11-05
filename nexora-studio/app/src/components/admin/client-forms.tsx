"use client";

import { Plus, Send } from "lucide-react";
import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import {
  type AdminActionResult,
  adminCreateClientWorkspaceAction,
  adminInviteOwnerAction,
} from "@/lib/actions/admin";
import type { InviteState } from "@/lib/actions/team";

/** "Nuova azienda per un cliente": poi si compila l'onboarding al suo posto. */
export function NewClientForm() {
  const [state, action] = useActionState<AdminActionResult | null, FormData>(
    adminCreateClientWorkspaceAction,
    null,
  );
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="sm:col-span-2">
        <FormMessage state={state ? { error: state.error } : null} />
      </div>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Nome dell&apos;azienda del cliente</span>
        <Input name="name" maxLength={120} required placeholder="Es. Pizzeria Da Mario" />
      </label>
      <SubmitButton variant="brand" pendingLabel="Creazione…">
        <Plus aria-hidden /> Crea e compila il profilo
      </SubmitButton>
    </ActionForm>
  );
}

/** Invito del cliente come titolare (email con link; se l'invio email non è attivo, il link da copiare). */
export function InviteOwnerForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState<InviteState, FormData>(adminInviteOwnerAction, null);
  return (
    <ActionForm action={action} className="grid gap-2">
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <FormMessage state={state} />
      {state?.inviteLink && (
        <code className="block truncate rounded-md bg-muted px-2 py-1 text-xs">
          {state.inviteLink}
        </code>
      )}
      <div className="flex gap-2">
        <Input
          name="email"
          type="email"
          required
          placeholder="Email del titolare"
          aria-label="Email del titolare"
          aria-invalid={state?.fieldErrors?.email ? true : undefined}
          className="h-9"
        />
        <SubmitButton size="sm" pendingLabel="Invio…">
          <Send aria-hidden /> Invita
        </SubmitButton>
      </div>
      {state?.fieldErrors?.email && (
        <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
      )}
    </ActionForm>
  );
}
