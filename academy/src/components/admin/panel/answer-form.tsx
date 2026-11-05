"use client";

import { useActionState } from "react";
import { answerQuestion, type ActionState } from "@/app/admin/panel-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function AnswerForm({ questionId }: { questionId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(answerQuestion, null);
  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="question_id" value={questionId} />
      <label htmlFor={`r-${questionId}`} className="sr-only">
        Risposta
      </label>
      <Textarea
        id={`r-${questionId}`}
        name="testo"
        required
        rows={3}
        placeholder="Scrivi la risposta: la vedono tutti gli studenti del corso."
      />
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Pubblico…" : "Rispondi"}
      </Button>
    </form>
  );
}
