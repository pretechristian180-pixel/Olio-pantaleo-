"use client";

import { ActionForm } from "@/components/forms/action-form";
import { Check, Copy } from "lucide-react";
import { useActionState, useState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { inviteMember, type InviteState } from "@/lib/actions/team";

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState<InviteState, FormData>(inviteMember, null);
  const [copied, setCopied] = useState(false);

  return (
    <ActionForm action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <FormMessage state={state} />
      {state?.inviteLink && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2 pl-3">
          <code className="min-w-0 flex-1 truncate text-xs">{state.inviteLink}</code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(state.inviteLink!);
              setCopied(true);
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copiato" : "Copia"}
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <Field id="invite-email" label="Email del collaboratore" error={state?.fieldErrors?.email}>
          {(p) => <Input name="email" type="email" inputMode="email" autoComplete="off" {...p} />}
        </Field>
        <Field id="invite-role" label="Ruolo">
          {(p) => (
            <NativeSelect name="role" defaultValue="member" {...p}>
              <option value="member">Collaboratore</option>
              <option value="owner">Titolare</option>
            </NativeSelect>
          )}
        </Field>
        <SubmitButton pendingLabel="Invio…">Invita</SubmitButton>
      </div>
    </ActionForm>
  );
}
