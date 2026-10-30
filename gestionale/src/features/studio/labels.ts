import type { Tone } from "@/lib/labels";
import type { AvatarStatus, BrandTone, Platform, PostStatus, VideoStatus, WeekDay } from "@/types/studio";

export const videoStatus: Record<VideoStatus, { label: string; tone: Tone }> = {
  bozza: { label: "Bozza", tone: "gray" },
  script_pronto: { label: "Testo pronto", tone: "gray" },
  in_generazione: { label: "In preparazione", tone: "sky" },
  da_approvare: { label: "Da approvare", tone: "brand" },
  modifiche_richieste: { label: "Modifiche richieste", tone: "orange" },
  approvato: { label: "Approvato", tone: "green" },
  programmato: { label: "Programmato", tone: "navy" },
  pubblicato: { label: "Pubblicato", tone: "green" },
  errore: { label: "Errore", tone: "red" },
  scartato: { label: "Scartato", tone: "gray" },
};

export const platformLabel: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

/** Dove l'etichetta "contenuto AI" si attiva anche come impostazione della piattaforma */
export const platformAiLabel: Record<Platform, string> = {
  instagram: "Etichetta \"Creato con l'AI\" attiva",
  facebook: "Etichetta \"Creato con l'AI\" attiva",
  tiktok: "Etichetta \"Contenuto generato dall'AI\" attiva",
};

export const postStatus: Record<PostStatus, { label: string; tone: Tone }> = {
  in_coda: { label: "In programma", tone: "navy" },
  pubblicato: { label: "Pubblicato", tone: "green" },
  fallito: { label: "Non pubblicato", tone: "red" },
};

export const avatarStatus: Record<AvatarStatus, { label: string; tone: Tone }> = {
  in_attesa_consenso: { label: "Da completare", tone: "orange" },
  in_addestramento: { label: "In preparazione", tone: "sky" },
  pronto: { label: "Pronto", tone: "green" },
  revocato: { label: "Consenso revocato", tone: "red" },
};

export const toneLabel: Record<BrandTone, { label: string; hint: string }> = {
  professionale: { label: "Professionale", hint: "Chiaro e rassicurante" },
  amichevole: { label: "Amichevole", hint: "Caldo, dà del tu" },
  ironico: { label: "Ironico", hint: "Leggero, con una battuta" },
};

export const weekDays: { id: WeekDay; label: string }[] = [
  { id: "lun", label: "Lunedì" },
  { id: "mar", label: "Martedì" },
  { id: "mer", label: "Mercoledì" },
  { id: "gio", label: "Giovedì" },
  { id: "ven", label: "Venerdì" },
  { id: "sab", label: "Sabato" },
  { id: "dom", label: "Domenica" },
];

/** "ven 31 ott, 12:30" */
export function formatSlot(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Valore per <input type="datetime-local"> nell'ora del telefono */
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Caption come verrà pubblicata: testo, hashtag, dicitura AI sempre in fondo */
export function finalCaption(caption: string, hashtags: string[], disclaimer: string) {
  const tags = [...new Set(hashtags.filter(Boolean))].join(" ");
  return [caption.trim(), tags, disclaimer.trim()].filter(Boolean).join("\n\n");
}

export const MIN_PHOTOS = 5;
export const MAX_PHOTOS = 10;
