/**
 * Modello dati usato dall'interfaccia.
 * I servizi in src/services/api.ts traducono le righe del database (colonne in italiano,
 * vedi types/database.ts) in questi oggetti, così i componenti restano semplici.
 * Ogni entità appartiene a un'agenzia: la separazione è garantita dalle policy RLS.
 */
import type { Enums } from "./database";

export type ID = string;

export type Plan = Enums<"piano_agenzia">;
export type Role = Enums<"ruolo_utente">;

export interface Agency {
  id: ID;
  name: string;
  logoPath: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  plan: Plan;
}

export interface Agent {
  id: ID;
  agencyId: ID;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  active: boolean;
}

/* ---------- Immobili ---------- */

export type Contract = Enums<"tipo_contratto">;
export type PropertyStatus = Enums<"stato_immobile">;
export type PropertyKind = Enums<"tipo_immobile">;

/** Foto: `path` è il file su Supabase Storage, `url` il link temporaneo per mostrarla. */
export interface PropertyPhoto {
  id: ID;
  path?: string;
  url?: string;
  scene: "esterno" | "soggiorno" | "cucina" | "camera" | "vista";
}

export interface Property {
  id: ID;
  agencyId: ID;
  agentId: ID | null;
  kind: PropertyKind;
  title: string;
  address: string;
  city: string;
  zone: string;
  contract: Contract;
  status: PropertyStatus;
  price: number;
  sqm: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor?: string;
  energyClass?: string;
  description: string;
  photos: PropertyPhoto[];
  ownerId: ID | null;
  mandateStart: string | null;
  mandateEnd: string | null;
  /** Caratteristiche (balcone, box auto, ascensore…) */
  features?: string[];
  lat?: number | null;
  lng?: number | null;
  /** Tinta dell'illustrazione mostrata quando non ci sono foto */
  tint: number;
  createdAt: string;
}

export interface PropertyStats {
  visits: number;
  deals: number;
  daysOnline: number;
}

/* ---------- Contatti ---------- */

export type ContactRole = Enums<"tipo_contatto">;
export type Temperature = Enums<"temperatura_contatto">;
export type ContactSource = Enums<"fonte_contatto">;

export interface SearchCriteria {
  /** Assente nei dati vecchi o non ancora salvati */
  id?: ID;
  /** Nome facoltativo, es. "Casa al mare" */
  name?: string;
  /** Caratteristiche desiderate (balcone, box auto…) */
  features?: string[];
  active?: boolean;
  notes?: string;
  zones: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  sqmMin: number | null;
  roomsMin: number | null;
  contract: Contract | null;
  kind: PropertyKind | null;
}

export type ActivityKind = Enums<"tipo_attivita">;

export interface Activity {
  id: ID;
  kind: ActivityKind;
  text: string;
  date: string;
}

export interface Contact {
  id: ID;
  agencyId: ID;
  agentId: ID | null;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: ContactRole;
  temperature: Temperature;
  source: ContactSource | null;
  notes?: string;
  /** Prima richiesta attiva (compatibilità con le schermate esistenti) */
  search?: SearchCriteria;
  /** Tutte le richieste del cliente */
  searches?: SearchCriteria[];
  tags?: string[];
  birthday?: string | null;
  marketingConsent?: boolean;
  createdAt: string;
}

/* ---------- Trattative ---------- */

export type DealStage = Enums<"fase_trattativa">;

export interface Deal {
  id: ID;
  agencyId: ID;
  agentId: ID | null;
  contactId: ID;
  propertyId: ID | null;
  stage: DealStage;
  value: number;
  commission: number | null;
  updatedAt: string;
}

/* ---------- Agenda ---------- */

export type AppointmentKind = Enums<"tipo_appuntamento">;

export interface Appointment {
  id: ID;
  agencyId: ID;
  agentId: ID | null;
  kind: AppointmentKind;
  /** ISO date-time di inizio */
  start: string;
  end: string;
  durationMin: number;
  contactId: ID | null;
  propertyId?: ID;
  note?: string;
  outcome?: string;
}

/* ---------- Cose da fare ---------- */

export interface Task {
  id: ID;
  agencyId: ID;
  text: string;
  detail?: string;
  contactId?: ID;
  propertyId?: ID;
  dueDate: string | null;
  done: boolean;
  automatic: boolean;
}

/* ---------- Inviti ---------- */

export interface Invitation {
  id: ID;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  acceptedAt: string | null;
}

/* ---------- Matching ---------- */

export type MatchStatus = Enums<"stato_match">;

/** Un immobile compatibile con la ricerca di un acquirente, con punteggio (0-100) e motivi. */
export interface Match {
  id: ID;
  propertyId: ID;
  contactId: ID;
  score: number;
  reasons: string[];
  status: MatchStatus;
  proposedAt: string | null;
}

export interface Zone {
  id: ID;
  name: string;
}
