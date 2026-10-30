/**
 * Acquisizioni: la pipeline per trovare il proprietario e ottenere l'incarico.
 * Colonne del database in italiano (supabase/migrations/*_acquisizioni.sql), tradotte da services/acquisitions.ts.
 */
import type { ID, PropertyKind, Temperature } from "./domain";

export type AcqPhase =
  | "segnalazione"
  | "primo_contatto"
  | "valutazione_fissata"
  | "valutazione_fatta"
  | "proposta_incarico"
  | "incarico_firmato"
  | "persa";
export type AcqSource = "passaparola" | "cartello" | "portale" | "telefonata" | "porta_a_porta" | "social" | "altro";
export type LossReason = "prezzo" | "altra_agenzia" | "non_vende_piu" | "privato" | "altro";

export interface Acquisition {
  id: ID;
  agentId: ID | null;
  contactId: ID | null;
  owner?: { id: ID; firstName: string; lastName: string; phone: string | null };
  address: string;
  city: string;
  zone: string;
  kind: PropertyKind | null;
  sqm: number | null;
  askingPrice: number | null;
  valuedPrice: number | null;
  source: AcqSource | null;
  phase: AcqPhase;
  phaseSince: string;
  lossReason: LossReason | null;
  temperature: Temperature;
  nextAction: string;
  nextActionDate: string | null;
  propertyId: ID | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

/** Campi modificabili dalla scheda (fase e immobile cambiano solo con setPhase) */
export type AcquisitionPatch = Partial<
  Pick<
    Acquisition,
    "address" | "city" | "zone" | "kind" | "sqm" | "askingPrice" | "valuedPrice" | "source" | "temperature" | "nextAction" | "nextActionDate" | "notes" | "agentId" | "contactId"
  >
>;
