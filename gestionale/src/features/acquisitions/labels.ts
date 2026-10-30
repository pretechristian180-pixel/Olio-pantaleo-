import type { Tone } from "@/lib/labels";
import type { AcqPhase, AcqSource, LossReason } from "@/types/acquisitions";

/** Fasi attive della pipeline (la "persa" si gestisce a parte) */
export const acqPhases: { id: Exclude<AcqPhase, "persa">; label: string; short: string }[] = [
  { id: "segnalazione", label: "Segnalazione", short: "Segnalazione" },
  { id: "primo_contatto", label: "Primo contatto", short: "Contattato" },
  { id: "valutazione_fissata", label: "Valutazione fissata", short: "Valutazione fissata" },
  { id: "valutazione_fatta", label: "Valutazione fatta", short: "Valutato" },
  { id: "proposta_incarico", label: "Proposta di incarico", short: "Proposta" },
  { id: "incarico_firmato", label: "Incarico firmato", short: "Firmato" },
];

export const phaseLabel = (p: AcqPhase) => (p === "persa" ? "Persa" : acqPhases.find((x) => x.id === p)!.label);

export const phaseTone: Record<AcqPhase, Tone> = {
  segnalazione: "gray",
  primo_contatto: "sky",
  valutazione_fissata: "navy",
  valutazione_fatta: "amber",
  proposta_incarico: "brand",
  incarico_firmato: "green",
  persa: "red",
};

export const sourceLabel: Record<AcqSource, string> = {
  passaparola: "Passaparola",
  cartello: "Cartello",
  portale: "Portale",
  telefonata: "Telefonata",
  porta_a_porta: "Porta a porta",
  social: "Social",
  altro: "Altro",
};

export const lossLabel: Record<LossReason, string> = {
  prezzo: "Prezzo troppo alto",
  altra_agenzia: "Ha scelto un'altra agenzia",
  non_vende_piu: "Non vende più",
  privato: "Vende da privato",
  altro: "Altro",
};

/** Giorni nella fase attuale */
export function daysInPhase(since: string, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 86_400_000));
}

export const STALE_DAYS = 14;
