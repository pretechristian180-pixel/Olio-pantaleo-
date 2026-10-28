/**
 * Modello dati del gestionale.
 * Ogni entità appartiene a un'agenzia (`agencyId`): quando collegheremo Supabase
 * questo campo diventa la colonna `agency_id` usata dalle policy RLS per tenere
 * separate le agenzie.
 */

export type ID = string;

export interface Agency {
  id: ID;
  name: string;
  city: string;
}

export interface Agent {
  id: ID;
  agencyId: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/* ---------- Immobili ---------- */

export type Contract = "vendita" | "affitto";
export type PropertyStatus = "disponibile" | "trattativa" | "venduto";
export type PropertyKind = "appartamento" | "villa" | "trullo" | "masseria" | "attico" | "casa";

/** Foto: `url` sarà un file su Supabase Storage. Senza url mostriamo un'illustrazione. */
export interface PropertyPhoto {
  id: ID;
  url?: string;
  scene: "esterno" | "soggiorno" | "cucina" | "camera" | "vista";
}

export interface Property {
  id: ID;
  agencyId: ID;
  kind: PropertyKind;
  title: string;
  address: string;
  city: string;
  zone: string;
  contract: Contract;
  status: PropertyStatus;
  price: number;
  sqm: number;
  rooms: number;
  bathrooms: number;
  floor?: string;
  energyClass?: string;
  description: string;
  photos: PropertyPhoto[];
  ownerId: ID;
  /** Tinta usata dall'illustrazione segnaposto */
  tint: number;
  stats: { views: number; contacts: number; onlineSince: string };
  createdAt: string;
}

/* ---------- Contatti ---------- */

export type ContactRole = "acquirente" | "proprietario";
export type Temperature = "caldo" | "tiepido" | "freddo";

export interface SearchCriteria {
  zones: string[];
  budgetMax: number;
  sqmMin: number;
  contract: Contract;
  notes?: string;
}

export type ActivityKind = "chiamata" | "whatsapp" | "visita" | "email" | "proposta" | "nota";

export interface Activity {
  id: ID;
  kind: ActivityKind;
  text: string;
  date: string;
}

export interface Contact {
  id: ID;
  agencyId: ID;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: ContactRole;
  temperature: Temperature;
  search?: SearchCriteria;
  activities: Activity[];
  proposedPropertyIds: ID[];
  createdAt: string;
}

/* ---------- Trattative ---------- */

export type DealStage = "nuovo" | "visita" | "proposta" | "compromesso" | "rogito";

export interface Deal {
  id: ID;
  agencyId: ID;
  contactId: ID;
  propertyId: ID;
  stage: DealStage;
  value: number;
  updatedAt: string;
}

/* ---------- Agenda ---------- */

export type AppointmentKind = "visita" | "valutazione" | "firma";

export interface Appointment {
  id: ID;
  agencyId: ID;
  kind: AppointmentKind;
  /** ISO date-time di inizio */
  start: string;
  durationMin: number;
  contactId: ID;
  propertyId?: ID;
  note?: string;
}

/* ---------- Cose da fare ---------- */

export interface Task {
  id: ID;
  agencyId: ID;
  text: string;
  detail?: string;
  contactId?: ID;
  propertyId?: ID;
  done: boolean;
}
