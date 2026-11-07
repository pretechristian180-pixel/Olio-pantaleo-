"use client";

import { useActionState } from "react";
import type { Features } from "@/lib/features";
import type { OfferState } from "@/app/piattaforma/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FeatureFields } from "./feature-fields";
import { OfferFields } from "./offer-fields";

/** Omaggio e funzioni incluse di un'academy esistente. */
export function OfferForm({
  action,
  omaggio,
  omaggioFine,
  defaults,
}: {
  action: (prev: OfferState, formData: FormData) => Promise<OfferState>;
  omaggio: boolean;
  omaggioFine: string | null;
  defaults: Features;
}) {
  const [state, formAction, pending] = useActionState<OfferState, FormData>(action, null);
  return (
    <form action={formAction} className="space-y-6">
      <OfferFields
        defaultTipo={omaggio ? "omaggio" : "prova"}
        defaultFine={omaggioFine}
        showProva={false}
      />
      <FeatureFields defaults={defaults} />
      {state && (
        <Alert tone={state.ok ? "success" : "error"}>
          {state.ok ? "Salvato: le nuove condizioni valgono subito." : state.error}
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvo…" : "Salva omaggio e funzioni"}
      </Button>
    </form>
  );
}
