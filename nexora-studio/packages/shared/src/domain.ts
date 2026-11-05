/** Tipi di dominio condivisi tra app e worker. Rispecchiano gli enum del database (Fase 1). */

export const USER_ROLES = ["owner", "member"] as const;
export type WorkspaceRole = (typeof USER_ROLES)[number];

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "linkedin"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SCRIPT_FORMATS = [
  "talking_head",
  "tutorial",
  "behind_the_scenes",
  "product",
  "testimonial",
] as const;
export type ScriptFormat = (typeof SCRIPT_FORMATS)[number];

export const VIDEO_STATUSES = [
  "queued",
  "editing",
  "internal_review",
  "review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "error",
] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const JOB_TYPES = ["transcribe", "edit", "render", "publish", "generate_scripts", "send_email", "sync_social", "retention"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["queued", "running", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Tentativi massimi per un job prima dello stato `error` e dell'alert agli admin. */
export const JOB_MAX_ATTEMPTS = 3;

/** Costo di una chiamata a un provider esterno, per il calcolo del costo per video. */
export interface ProviderCost {
  provider: string;
  model?: string;
  /** Costo in dollari USA (i fornitori fatturano in USD), con decimali. */
  costUsd: number;
  /** Unità consumate, per provider (token, secondi di audio, secondi di video...). */
  units?: Record<string, number>;
}

/** Settori proposti nell'onboarding (vincolo `workspaces.sector`). */
export const SECTORS = [
  { value: "ristorazione", label: "Ristorazione" },
  { value: "automotive", label: "Concessionaria o officina" },
  { value: "immobiliare", label: "Agenzia immobiliare" },
  { value: "studio_professionale", label: "Studio professionale" },
  { value: "retail", label: "Negozio" },
  { value: "beauty_benessere", label: "Bellezza e benessere" },
  { value: "fitness", label: "Palestra e fitness" },
  { value: "artigianato", label: "Artigianato" },
  { value: "turismo", label: "Turismo e ospitalità" },
  { value: "altro", label: "Altro" },
] as const;
export type Sector = (typeof SECTORS)[number]["value"];

/** Giorni ISO (1 = lunedì) con etichette italiane. */
export const WEEKDAYS = [
  { value: 1, short: "Lun", label: "Lunedì" },
  { value: 2, short: "Mar", label: "Martedì" },
  { value: 3, short: "Mer", label: "Mercoledì" },
  { value: 4, short: "Gio", label: "Giovedì" },
  { value: 5, short: "Ven", label: "Venerdì" },
  { value: 6, short: "Sab", label: "Sabato" },
  { value: 7, short: "Dom", label: "Domenica" },
] as const;

/** Stile di montaggio salvato in `brand_profiles.edit_style`. */
export interface EditStyle {
  pace?: "calmo" | "medio" | "veloce";
  subtitles?: {
    style?: "pulito" | "evidenziato" | "karaoke";
    size?: "piccoli" | "medi" | "grandi";
  };
  music?: {
    mood?: "energica" | "rilassata" | "elegante" | "nessuna";
  };
  broll_usage?: "nessuno" | "poco" | "spesso";
  logo_outro?: boolean;
}
