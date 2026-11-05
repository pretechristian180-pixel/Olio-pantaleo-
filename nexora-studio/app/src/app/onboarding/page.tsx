import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandForm } from "@/components/brand-forms/brand-form";
import { CompanyForm } from "@/components/brand-forms/company-form";
import { ExamplesForm } from "@/components/brand-forms/examples-form";
import { PublishingForm } from "@/components/brand-forms/publishing-form";
import { Card, CardContent } from "@/components/ui/card";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { firstName, getSessionContext } from "@/lib/workspace";

import { BackButton, BackForm } from "./back-button";
import { StepHeading, Steps } from "./steps";

export const metadata: Metadata = { title: "Configura il tuo account" };

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/accedi?next=/onboarding");

  const active = ctx.active;
  if (active?.workspace.onboarding_completed_at) redirect("/inizio");
  // Un collaboratore non configura l'azienda: aspetta il titolare.
  if (active && active.role !== "owner") redirect("/inizio");

  const ws = active?.workspace ?? null;
  const step = ws ? Math.min(Math.max(ws.onboarding_step, 1), ONBOARDING_STEPS.publishing) : 1;
  const name = firstName(ctx);

  let content: React.ReactNode;

  if (step === ONBOARDING_STEPS.company || !ws) {
    content = (
      <>
        <StepHeading
          title={`Ciao ${name}, parliamo della tua azienda`}
          description="Servono pochi dati: li usiamo per scrivere script che parlano davvero di te."
        />
        <CompanyForm workspace={ws} mode="onboarding" submitLabel="Continua" />
      </>
    );
  } else if (step === ONBOARDING_STEPS.brand) {
    const supabase = await createClient();
    const { data: brand } = await supabase
      .from("brand_profiles")
      .select("tone_of_voice, target_audience, services, do_not_say")
      .eq("workspace_id", ws.id)
      .single();
    content = (
      <>
        <StepHeading
          title="Il tuo brand"
          description="Logo, colori e il modo in cui parli ai clienti. Puoi cambiare tutto quando vuoi."
        />
        <BrandForm
          workspace={ws}
          brand={
            brand ?? {
              tone_of_voice: null,
              target_audience: null,
              services: null,
              do_not_say: null,
            }
          }
          logoUrl={await signedUrl("brand", ws.logo_url)}
          mode="onboarding"
          canEditVisuals
          submitLabel="Continua"
          footer={<BackButton workspaceId={ws.id} step={ONBOARDING_STEPS.company} />}
        />
        <BackForm workspaceId={ws.id} step={ONBOARDING_STEPS.company} />
      </>
    );
  } else if (step === ONBOARDING_STEPS.examples) {
    const supabase = await createClient();
    const { data: brand } = await supabase
      .from("brand_profiles")
      .select("reference_videos")
      .eq("workspace_id", ws.id)
      .single();
    content = (
      <>
        <StepHeading
          title="Video che ti piacciono"
          description="Carica da 1 a 3 video con lo stile che vorresti: ritmo, sottotitoli, musica. Possono essere anche di altri. Se non li hai sotto mano, puoi saltare questo passo."
        />
        <ExamplesForm
          workspaceId={ws.id}
          initialPaths={brand?.reference_videos ?? []}
          mode="onboarding"
          submitLabel="Continua"
          footer={<BackButton workspaceId={ws.id} step={ONBOARDING_STEPS.brand} />}
        />
        <BackForm workspaceId={ws.id} step={ONBOARDING_STEPS.brand} />
      </>
    );
  } else {
    content = (
      <>
        <StepHeading
          title="Quando pubblichiamo?"
          description="Scegli quanti video a settimana e in quali giorni. Su questa base prepariamo gli script."
        />
        <PublishingForm
          workspace={ws}
          mode="onboarding"
          submitLabel="Finito, inizia!"
          footer={<BackButton workspaceId={ws.id} step={ONBOARDING_STEPS.examples} />}
        />
        <BackForm workspaceId={ws.id} step={ONBOARDING_STEPS.examples} />
      </>
    );
  }

  return (
    <div className="grid gap-8">
      <Steps current={step} />
      <Card className="border-0 bg-transparent py-0 shadow-none sm:border sm:bg-card sm:py-8 sm:shadow-xs">
        <CardContent className="grid gap-8 px-0 sm:px-8">{content}</CardContent>
      </Card>
    </div>
  );
}
