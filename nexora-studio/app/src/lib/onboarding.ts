/** Passi dell'onboarding salvati in `workspaces.onboarding_step`. */
export const ONBOARDING_STEPS = {
  company: 1,
  brand: 2,
  examples: 3,
  publishing: 4,
} as const;

export const ONBOARDING_STEP_LABELS = ["Azienda", "Brand", "Video di esempio", "Pubblicazione"];

/** Giorni proposti per ogni frequenza settimanale. */
export const DEFAULT_DAYS: Record<number, number[]> = {
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
};
