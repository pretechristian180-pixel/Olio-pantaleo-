"use client";

import { ActionForm } from "@/components/forms/action-form";
import type { Tables } from "@nexora/shared";
import { useActionState, useRef } from "react";

import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { saveBrand } from "@/lib/actions/workspace";

import { LogoAndColors } from "./logo-colors";

const TONE_SUGGESTIONS = [
  "Professionale",
  "Simpatico",
  "Diretto",
  "Elegante",
  "Ironico",
  "Rassicurante",
  "Tecnico ma semplice",
  "Familiare",
];

export function BrandForm({
  workspace,
  brand,
  logoUrl,
  mode,
  canEditVisuals,
  submitLabel = "Salva",
  footer,
}: {
  workspace: Pick<Tables<"workspaces">, "id" | "logo_url" | "brand_colors">;
  brand: Pick<
    Tables<"brand_profiles">,
    "tone_of_voice" | "target_audience" | "services" | "do_not_say"
  >;
  logoUrl: string | null;
  mode: "onboarding" | "settings";
  canEditVisuals: boolean;
  submitLabel?: string;
  footer?: React.ReactNode;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveBrand, null);
  const fe = state?.fieldErrors ?? {};
  const toneRef = useRef<HTMLTextAreaElement>(null);
  const colors = Array.isArray(workspace.brand_colors)
    ? workspace.brand_colors.filter((c): c is string => typeof c === "string")
    : [];

  function addTone(word: string) {
    const el = toneRef.current;
    if (!el) return;
    const current = el.value.trim();
    if (current.toLowerCase().includes(word.toLowerCase())) return;
    el.value = current ? `${current}, ${word.toLowerCase()}` : word;
    el.focus();
  }

  return (
    <ActionForm action={action} className="grid gap-6" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="workspace_id" value={workspace.id} />
      <FormMessage state={state} />

      <LogoAndColors
        workspaceId={workspace.id}
        initialLogoPath={workspace.logo_url}
        initialLogoUrl={logoUrl}
        initialColors={colors}
        disabled={!canEditVisuals}
      />
      {fe.logo && (
        <p role="alert" className="text-[0.8125rem] font-medium text-destructive">
          {fe.logo}
        </p>
      )}

      <div className="grid gap-2.5">
        <Field
          id="tone_of_voice"
          label="Come parla la tua azienda?"
          hint="Tocca i suggerimenti o scrivi con parole tue."
          error={fe.tone_of_voice}
        >
          {(p) => (
            <Textarea
              ref={toneRef}
              name="tone_of_voice"
              defaultValue={brand.tone_of_voice ?? ""}
              placeholder="Es. simpatico e diretto, diamo del tu ai clienti"
              rows={2}
              {...p}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-2" aria-label="Suggerimenti per il tono di voce">
          {TONE_SUGGESTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTone(t)}
              className="h-8 rounded-full border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-nx-blue-500/60 hover:text-foreground"
            >
              + {t}
            </button>
          ))}
        </div>
      </div>

      <Field
        id="target_audience"
        label="A chi ti rivolgi?"
        hint="Chi sono i tuoi clienti tipo: età, zona, cosa cercano."
        error={fe.target_audience}
      >
        {(p) => (
          <Textarea
            name="target_audience"
            defaultValue={brand.target_audience ?? ""}
            placeholder="Es. famiglie e giovani coppie di Bari che cercano una pizza di qualità"
            rows={2}
            {...p}
          />
        )}
      </Field>

      <Field
        id="services"
        label="Servizi o prodotti principali"
        hint="Quelli di cui vuoi parlare nei video."
        error={fe.services}
      >
        {(p) => (
          <Textarea
            name="services"
            defaultValue={brand.services ?? ""}
            placeholder="Es. pizza napoletana, impasti a lunga lievitazione, consegna a domicilio"
            rows={3}
            {...p}
          />
        )}
      </Field>

      <Field
        id="do_not_say"
        label="Cose da non dire mai"
        hint="Facoltativo. Parole, argomenti o promesse da evitare."
        error={fe.do_not_say}
      >
        {(p) => (
          <Textarea
            name="do_not_say"
            defaultValue={brand.do_not_say ?? ""}
            placeholder="Es. non parlare di prezzi, non citare i concorrenti"
            rows={2}
            {...p}
          />
        )}
      </Field>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {footer ?? <span />}
        <SubmitButton
          variant={mode === "onboarding" ? "brand" : "default"}
          size="lg"
          pendingLabel="Salvataggio…"
        >
          {submitLabel}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
