import type { Tone } from "@/lib/labels";
import type { Lead, LeadChannel, LeadState } from "@/types/leads";

export const channelLabel: Record<LeadChannel, string> = {
  sito: "Sito",
  facebook: "Facebook",
  instagram: "Instagram",
  portale: "Portale",
  email: "Email",
  prova: "Prova",
};

/** Da dove arriva, con il nome del portale quando c'è */
export const sourceLabel = (l: Pick<Lead, "channel" | "portal">) => l.portal || channelLabel[l.channel];

export const stateLabel: Record<LeadState, { label: string; tone: Tone }> = {
  nuovo: { label: "Da richiamare", tone: "brand" },
  contattato: { label: "Contattato", tone: "sky" },
  appuntamento: { label: "Appuntamento fissato", tone: "violet" },
  acquisito: { label: "Diventato cliente", tone: "green" },
  perso: { label: "Perso", tone: "gray" },
  spam: { label: "Spam", tone: "gray" },
};

export function scoreLevel(score: number): { label: string; tone: Tone } {
  if (score >= 60) return { label: "Caldo", tone: "red" };
  if (score >= 35) return { label: "Tiepido", tone: "amber" };
  return { label: "Freddo", tone: "sky" };
}

/** Minuti/ore dall'arrivo, in parole */
export function since(iso: string, now = Date.now()) {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ${h === 1 ? "ora" : "ore"} fa`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ieri" : `${d} giorni fa`;
}

/** Nessuno ha risposto da più di 2 ore */
export const isLate = (l: Lead, now = Date.now()) => l.state === "nuovo" && now - new Date(l.createdAt).getTime() > 2 * 3600_000;

export const lostReasons = ["Ha già comprato", "Cerca qualcosa di diverso", "Budget troppo basso", "Non risponde", "Solo curiosità"];
