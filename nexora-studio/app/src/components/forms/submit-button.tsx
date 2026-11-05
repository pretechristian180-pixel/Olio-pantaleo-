"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import { useActionFormPending } from "./action-form";

/** Pulsante di invio che si disattiva e mostra l'attesa mentre la Server Action lavora. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending: formPending } = useFormStatus();
  const actionFormPending = useActionFormPending();
  const pending = formPending || actionFormPending;
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
