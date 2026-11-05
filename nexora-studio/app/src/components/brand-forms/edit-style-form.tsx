"use client";

import { ActionForm } from "@/components/forms/action-form";
import type { EditStyle } from "@nexora/shared";
import { useActionState } from "react";

import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Choice, ChoiceGroup } from "@/components/ui/choice";
import { saveEditStyle } from "@/lib/actions/workspace";

const OPTIONS = {
  pace: [
    { value: "calmo", label: "Calmo", description: "Tagli morbidi, si respira" },
    { value: "medio", label: "Medio", description: "Il giusto ritmo" },
    { value: "veloce", label: "Veloce", description: "Tagli serrati, alta energia" },
  ],
  subtitles_style: [
    { value: "pulito", label: "Puliti", description: "Testo semplice" },
    { value: "evidenziato", label: "Evidenziati", description: "Parole chiave a colori" },
    { value: "karaoke", label: "Karaoke", description: "Parola per parola" },
  ],
  subtitles_size: [
    { value: "piccoli", label: "Piccoli" },
    { value: "medi", label: "Medi" },
    { value: "grandi", label: "Grandi" },
  ],
  music_mood: [
    { value: "energica", label: "Energica" },
    { value: "rilassata", label: "Rilassata" },
    { value: "elegante", label: "Elegante" },
    { value: "nessuna", label: "Senza musica" },
  ],
  broll_usage: [
    { value: "nessuno", label: "Mai", description: "Solo il tuo girato" },
    { value: "poco", label: "Ogni tanto", description: "Qualche immagine di supporto" },
    { value: "spesso", label: "Spesso", description: "Video più dinamici" },
  ],
} as const;

const DEFAULTS = {
  pace: "medio",
  subtitles_style: "evidenziato",
  subtitles_size: "medi",
  music_mood: "energica",
  broll_usage: "poco",
};

/** Preferenze di montaggio. In Fase 3 l'AI le completa analizzando i video di esempio. */
export function EditStyleForm({ workspaceId, style }: { workspaceId: string; style: EditStyle }) {
  const [state, action] = useActionState<FormState, FormData>(saveEditStyle, null);
  const current: Record<keyof typeof OPTIONS, string> = {
    pace: style.pace ?? DEFAULTS.pace,
    subtitles_style: style.subtitles?.style ?? DEFAULTS.subtitles_style,
    subtitles_size: style.subtitles?.size ?? DEFAULTS.subtitles_size,
    music_mood: style.music?.mood ?? DEFAULTS.music_mood,
    broll_usage: style.broll_usage ?? DEFAULTS.broll_usage,
  };
  const legends: Record<keyof typeof OPTIONS, string> = {
    pace: "Ritmo del montaggio",
    subtitles_style: "Sottotitoli",
    subtitles_size: "Grandezza dei sottotitoli",
    music_mood: "Musica di sottofondo",
    broll_usage: "Immagini di supporto (b-roll)",
  };

  return (
    <ActionForm action={action} className="grid gap-7">
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <FormMessage state={state} />
      {(Object.keys(OPTIONS) as (keyof typeof OPTIONS)[]).map((key) => (
        <ChoiceGroup
          key={key}
          id={key}
          legend={legends[key]}
          className="grid grid-cols-2 sm:grid-cols-4"
        >
          {OPTIONS[key].map((o) => (
            <Choice
              key={o.value}
              type="radio"
              name={key}
              value={o.value}
              label={o.label}
              description={"description" in o ? o.description : undefined}
              defaultChecked={current[key] === o.value}
            />
          ))}
        </ChoiceGroup>
      ))}
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="logo_outro"
          defaultChecked={style.logo_outro ?? true}
          className="size-5 rounded accent-[var(--nx-blue-500)]"
        />
        Mostra il logo alla fine di ogni video
      </label>
      <div className="flex justify-end">
        <SubmitButton size="lg" pendingLabel="Salvataggio…">
          Salva lo stile
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
