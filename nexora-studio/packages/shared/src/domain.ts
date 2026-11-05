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
  "review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "error",
] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const JOB_TYPES = ["transcribe", "edit", "render", "publish", "generate_scripts"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["queued", "running", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Tentativi massimi per un job prima dello stato `error` e dell'alert agli admin. */
export const JOB_MAX_ATTEMPTS = 3;

/** Costo di una chiamata a un provider esterno, per il calcolo del costo per video. */
export interface ProviderCost {
  provider: string;
  /** Costo in centesimi di euro. */
  amountCents: number;
  /** Unità consumate (secondi di audio, token, secondi di video...). */
  units?: number;
  unitLabel?: string;
}
