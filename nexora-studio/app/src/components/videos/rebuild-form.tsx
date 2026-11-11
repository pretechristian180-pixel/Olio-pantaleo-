"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { adminRebuildVideoAction } from "@/lib/actions/admin";

/** "Rimonta da capo" (solo team), con l'esito sempre visibile. */
export function RebuildForm({ videoId }: { videoId: string }) {
  const [state, action] = useActionState<FormState, FormData>(adminRebuildVideoAction, null);
  return (
    <ActionForm action={action} className="grid gap-2">
      <input type="hidden" name="video_id" value={videoId} />
      <FormMessage state={state} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Rimonto…">
        Rimonta da capo
      </SubmitButton>
    </ActionForm>
  );
}
