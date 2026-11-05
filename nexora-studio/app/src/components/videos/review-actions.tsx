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
export function ChangeRequest({
  videoId,
  remaining,
  extra,
  locked,
}: {
  videoId: string;
  remaining: number;
  /** Modifiche oltre le incluse: testo sul video che si consuma, o null se non ci sono video disponibili. */
  extra?: { note: string } | { blocked: string } | null;
  /** Girato originale cancellato (90 giorni): niente più modifiche. */
  locked?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, action] = useActionState<FormState, FormData>(requestChanges, null);
  const isExtra = remaining <= 0;

  if (locked) return <p className="text-sm text-muted-foreground">{locked}</p>;
  if (isExtra && extra && "blocked" in extra) {
    return (
      <p className="text-sm text-muted-foreground">
        Hai usato i 2 giri di modifiche inclusi. {extra.blocked}
      </p>
    );
  }
  if (!open) {
    return (
      <div className="grid gap-1.5">
        <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
          <MessageSquareText aria-hidden />{" "}
          {isExtra ? "Chiedi un'altra modifica" : "Chiedi una modifica"}
        </Button>
        {isExtra && extra && "note" in extra && (
          <p className="text-center text-xs text-muted-foreground">{extra.note}</p>
        )}
      </div>
    );
  }
  return (
    <ActionForm action={action} className="grid gap-3 rounded-xl border bg-card p-4">
      <input type="hidden" name="video_id" value={videoId} />
      {isExtra && <input type="hidden" name="extra" value="1" />}
      <FormMessage state={state} />
      <Field
        id="message"
        label="Cosa vuoi cambiare?"
        hint={
          isExtra
            ? `Scrivi a parole tue. ${extra && "note" in extra ? extra.note : ""}`
            : `Scrivi a parole tue. Ti ${remaining === 1 ? "resta 1 giro" : `restano ${remaining} giri`} di modifiche inclusi.`
        }
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
          {isExtra ? "Usa 1 video e invia" : "Invia la richiesta"}
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
