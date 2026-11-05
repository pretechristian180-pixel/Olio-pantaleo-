"use client";

import { MessageSquareText } from "lucide-react";
import { useActionState, useState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestChanges, updateCaption } from "@/lib/actions/videos";

const SUGGESTIONS = [
  "Togli la parte iniziale",
  "Sottotitoli più grandi",
  "Musica più bassa",
  "Taglia le pause",
];

/** "Chiedi una modifica" con suggerimenti rapidi e contatore dei giri inclusi. */
export function ChangeRequest({ videoId, remaining }: { videoId: string; remaining: number }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, action] = useActionState<FormState, FormData>(requestChanges, null);

  if (remaining <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Hai usato i 2 giri di modifiche inclusi. Per altre richieste scrivici: le valutiamo insieme.
      </p>
    );
  }
  if (!open) {
    return (
      <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
        <MessageSquareText aria-hidden /> Chiedi una modifica
      </Button>
    );
  }
  return (
    <ActionForm action={action} className="grid gap-3 rounded-xl border bg-card p-4">
      <input type="hidden" name="video_id" value={videoId} />
      <FormMessage state={state} />
      <Field
        id="message"
        label="Cosa vuoi cambiare?"
        hint={`Scrivi a parole tue. Ti ${remaining === 1 ? "resta 1 giro" : `restano ${remaining} giri`} di modifiche.`}
        error={state?.fieldErrors?.message}
      >
        {(p) => (
          <Textarea
            name="message"
            rows={3}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            {...p}
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-2" aria-label="Suggerimenti">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setMessage((m) => (m ? `${m}. ${s}` : s))}
            className="h-8 rounded-full border bg-background px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            + {s}
          </button>
        ))}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annulla
        </Button>
        <SubmitButton variant="brand" pendingLabel="Invio…">
          Invia la richiesta
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Didascalia e hashtag modificabili. */
export function CaptionForm({
  videoId,
  caption,
  hashtags,
  editable,
}: {
  videoId: string;
  caption: string;
  hashtags: string[];
  editable: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateCaption, null);
  return (
    <ActionForm action={action} className="grid gap-4">
      <input type="hidden" name="video_id" value={videoId} />
      <FormMessage state={state} />
      <fieldset disabled={!editable} className="grid gap-4">
        <Field id="caption" label="Didascalia" hint="Il testo che accompagna il video sui social.">
          {(p) => (
            <Textarea name="caption" rows={4} maxLength={2200} defaultValue={caption} {...p} />
          )}
        </Field>
        <Field id="hashtags" label="Hashtag" hint="Separati da spazi, senza #.">
          {(p) => (
            <Input name="hashtags" defaultValue={hashtags.join(" ")} autoCapitalize="none" {...p} />
          )}
        </Field>
      </fieldset>
      {editable && (
        <div className="flex justify-end">
          <SubmitButton variant="outline" pendingLabel="Salvataggio…">
            Salva la didascalia
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
