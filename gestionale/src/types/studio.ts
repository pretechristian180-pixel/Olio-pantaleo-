/**
 * Modello dati del modulo Studio (video social degli immobili).
 * Le colonne del database sono in italiano (vedi supabase/migrations/*_studio_fase1.sql):
 * src/services/studio.ts le traduce in questi oggetti.
 */
import type { ID } from "./domain";

export type VideoStatus =
  | "bozza"
  | "script_pronto"
  | "in_generazione"
  | "da_approvare"
  | "modifiche_richieste"
  | "approvato"
  | "programmato"
  | "pubblicato"
  | "errore"
  | "scartato";

export type Platform = "instagram" | "facebook" | "tiktok";
export type AvatarStatus = "in_attesa_consenso" | "in_addestramento" | "pronto" | "revocato";
export type BrandTone = "professionale" | "amichevole" | "ironico";
export type Outcome = "approvato" | "modifiche" | "scartato";
export type PostStatus = "in_coda" | "pubblicato" | "fallito";
export type Duration = 30 | 45 | 60;
export type WeekDay = "lun" | "mar" | "mer" | "gio" | "ven" | "sab" | "dom";

/** Dati essenziali dell'immobile mostrati nelle card dei video */
export interface VideoPropertyRef {
  id: ID;
  title: string;
  address: string;
  city: string;
}

export interface VideoProject {
  id: ID;
  propertyId: ID;
  createdBy: ID | null;
  duration: Duration;
  /** Foto scelte, nell'ordine del montaggio */
  photoIds: ID[];
  intro: string;
  outro: string;
  caption: string;
  hashtags: string[];
  status: VideoStatus;
  videoUrl: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  property: VideoPropertyRef;
  /** Link temporaneo alla prima foto scelta (anteprima della card) */
  thumbUrl?: string;
}

export interface Approval {
  id: ID;
  outcome: Outcome | null;
  note: string | null;
  via: "app" | "whatsapp";
  approverName: string | null;
  createdAt: string;
}

export interface ScheduledPost {
  id: ID;
  videoId: ID;
  platform: Platform;
  caption: string;
  publishAt: string;
  status: PostStatus;
  url: string | null;
  error: string | null;
}

/** Un post del calendario con il suo video */
export type CalendarPost = ScheduledPost & { video: Pick<VideoProject, "id" | "status" | "property" | "thumbUrl"> };

export interface BrandSettings {
  tone: BrandTone;
  closingLine: string;
  accentColor: string;
  fixedHashtags: string[];
  aiDisclaimer: string;
  preferredTimes: Record<WeekDay, string[]>;
  approverId: ID | null;
  defaultPlatforms: Platform[];
}

export interface AvatarProfile {
  id: ID;
  profileId: ID;
  personName: string;
  status: AvatarStatus;
  consentSigned: boolean;
  consentSignedAt: string | null;
  consentVersion: string | null;
  signer: string | null;
  consentPdfPath: string | null;
  trainingVideoPath: string | null;
}

export interface SocialAccount {
  id: ID;
  platform: Platform;
  name: string;
  status: "collegato" | "scaduto" | "errore";
  connectedAt: string;
  expiresAt: string | null;
}

export interface StudioUsage {
  month: string;
  used: number;
  included: number;
  extra: number;
  dailyLimit: number;
}

export interface ConsentTemplate {
  version: string;
  text: string;
}

export interface VideoDetail {
  video: VideoProject;
  /** Link temporanei alle foto scelte, nell'ordine */
  photoUrls: string[];
  approvals: Approval[];
  posts: ScheduledPost[];
  canApprove: boolean;
  canEdit: boolean;
}

/** Dati mostrati nella pagina pubblica di approvazione (link WhatsApp) */
export interface PublicApproval {
  agencyName: string;
  agencyPhone: string | null;
  property: { title: string; address: string; city: string };
  duration: Duration;
  intro: string;
  outro: string;
  caption: string;
  hashtags: string[];
  photoUrls: string[];
  aiDisclaimer: string;
  platforms: Platform[];
  publishAt: string | null;
}
