import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { goToOnboardingStep } from "@/lib/actions/workspace";

/** "Indietro": usa un form separato per non interferire con il form del passo. */
export function BackButton({ step }: { workspaceId: string; step: number }) {
  return (
    <Button variant="ghost" size="lg" type="submit" form={`back-${step}`}>
      <ArrowLeft aria-hidden /> Indietro
    </Button>
  );
}

export function BackForm({ workspaceId, step }: { workspaceId: string; step: number }) {
  return (
    <form id={`back-${step}`} action={goToOnboardingStep} hidden>
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <input type="hidden" name="step" value={step} />
    </form>
  );
}
