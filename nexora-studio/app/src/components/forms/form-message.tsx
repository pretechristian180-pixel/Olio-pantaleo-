import { CheckCircle2, CircleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
} | null;

/** Messaggio di esito di un form (errore generale o conferma). */
export function FormMessage({ state }: { state: FormState }) {
  if (state?.error) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription className="text-foreground">{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state?.success) {
    return (
      <Alert variant="success">
        <CheckCircle2 aria-hidden />
        <AlertDescription className="text-foreground">{state.success}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
