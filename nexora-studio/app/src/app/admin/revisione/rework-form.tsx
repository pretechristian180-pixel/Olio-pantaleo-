"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { adminRequestRework } from "@/lib/actions/videos";

export function ReworkForm({ videoId }: { videoId: string }) {
  const [state, action] = useActionState<FormState, FormData>(adminRequestRework, null);
  return (
    <ActionForm action={action} className="grid gap-2">
      <input type="hidden" name="video_id" value={videoId} />
      <FormMessage state={state} />
      <label htmlFor={`rework-${videoId}`} className="text-sm font-medium">
        Rimonta con istruzioni
      </label>
      <Textarea
        id={`rework-${videoId}`}
        name="message"
        rows={2}
        placeholder="Es. taglia l'inizio, sottotitoli più grandi"
      />
      <SubmitButton variant="outline" size="sm" pendingLabel="Invio…">
        Rimonta (non consuma i giri del cliente)
      </SubmitButton>
    </ActionForm>
  );
}
