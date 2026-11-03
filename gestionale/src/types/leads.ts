export type LeadChannel = "sito" | "facebook" | "instagram" | "portale" | "email" | "prova";
export type LeadState = "nuovo" | "contattato" | "appuntamento" | "acquisito" | "perso" | "spam";
export type LeadAssignment = "rotazione" | "agente_immobile" | "titolare";

export interface Lead {
  id: string;
  contactId: string | null;
  agentId: string | null;
  agentName: string | null;
  propertyId: string | null;
  propertyLabel: string | null;
  channel: LeadChannel;
  portal: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  reference: string | null;
  score: number;
  reasons: string[];
  state: LeadState;
  lostReason: string | null;
  firstContactAt: string | null;
  repeated: number;
  createdAt: string;
}

export interface LeadStats {
  total: number;
  byChannel: Record<string, number>;
  medianResponseMinutes: number | null;
  withinHour: number;
  appointments: number;
  toHandle: number;
}

export interface LeadSettings {
  assignment: LeadAssignment;
  rotation: string[];
  pages: { id: string; name: string; instagram: boolean; state: "collegata" | "da_ricollegare" | "scollegata" }[];
}

/** Cosa è attivo lato server (risposta della funzione lead-ingresso) */
export interface LeadIntake {
  token: string | null;
  formUrl: string;
  email: string | null;
  metaReady: boolean;
  aiEmail: boolean;
}
