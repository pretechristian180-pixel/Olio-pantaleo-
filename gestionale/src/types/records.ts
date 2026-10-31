/** Archivio documenti, checklist (documenti e antiriciclaggio) e scheda della visita */
import type { ID } from "./domain";

export type DocCategory =
  | "identita" | "provenienza" | "catasto" | "planimetria" | "ape" | "urbanistica" | "impianti" | "condominio"
  | "incarico" | "proposta" | "preliminare" | "rogito" | "antiriciclaggio" | "foto" | "altro";

/** A cosa è collegato un documento o una checklist */
export type RecordRef = { contactId?: ID; propertyId?: ID; dealId?: ID; acquisitionId?: ID };

export interface DocumentItem {
  id: ID;
  category: DocCategory;
  name: string;
  path: string;
  mime: string | null;
  size: number | null;
  expiresOn: string | null;
  notes: string | null;
  uploadedBy: ID | null;
  createdAt: string;
}

export type ChecklistKind = "documenti" | "antiriciclaggio";
export type ChecklistState = "da_fare" | "fatto" | "non_serve";

export interface ChecklistItem {
  id: ID;
  kind: ChecklistKind;
  label: string;
  help: string | null;
  required: boolean;
  state: ChecklistState;
  documentId: ID | null;
  dueOn: string | null;
  note: string | null;
  doneBy: string | null;
  doneAt: string | null;
  order: number;
}

export type PriceOpinion = "basso" | "giusto" | "alto";
export type VisitIntent = "proposta" | "ci_pensa" | "altro_immobile" | "non_interessato";

export interface VisitFeedback {
  id: ID;
  appointmentId: ID;
  contactId: ID | null;
  propertyId: ID | null;
  rating: number | null;
  liked: string;
  disliked: string;
  issues: string;
  priceOpinion: PriceOpinion | null;
  offer: number | null;
  intent: VisitIntent | null;
  otherProperties: string;
  createdAt: string;
  contactName?: string;
}

export type VisitFeedbackInput = Omit<VisitFeedback, "id" | "createdAt" | "contactName">;

/** Per la schermata Oggi */
export interface PaperworkSummary {
  missing: { propertyId: ID; address: string; count: number }[];
  expiring: { id: ID; name: string; expiresOn: string; propertyId: ID | null; contactId: ID | null }[];
}
