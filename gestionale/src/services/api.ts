/**
 * Livello di accesso ai dati. Tutte le pagine passano da qui, mai dai dati finti diretti.
 * Ogni funzione è asincrona come lo sarà con Supabase: per il collegamento basterà
 * sostituire il corpo delle funzioni con le query (`supabase.from("properties")...`).
 */
import { agency, currentAgent } from "@/data/mock";
import { addDays, isSameDay, startOfDay } from "@/lib/format";
import type {
  Appointment,
  AppointmentKind,
  Contact,
  ContactRole,
  Contract,
  Deal,
  DealStage,
  ID,
  Property,
  PropertyStatus,
  Task,
} from "@/types/domain";
import { db, emitChange, newId } from "./store";

const LATENCY = 450;
const wait = <T,>(value: T, ms = LATENCY) => new Promise<T>((r) => setTimeout(() => r(value), ms));

/* ---------- Sessione ---------- */

export function getSession() {
  return { agent: currentAgent, agency };
}

/* ---------- Riferimenti ---------- */

const findContact = (id: ID) => db.contacts.find((c) => c.id === id);
const findProperty = (id?: ID) => (id ? db.properties.find((p) => p.id === id) : undefined);

/* ---------- Oggi ---------- */

export interface TodaySummary {
  appointments: AppointmentWithRefs[];
  newLeads: number;
  expiringMandates: number;
  tasks: TaskWithRefs[];
}

export async function getToday(): Promise<TodaySummary> {
  const today = new Date();
  const appointments = db.appointments
    .filter((a) => isSameDay(new Date(a.start), today))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(withRefs);
  const weekAgo = addDays(startOfDay(today), -7).toISOString();
  const newLeads = db.contacts.filter((c) => c.role === "acquirente" && c.createdAt >= weekAgo).length;
  return wait({
    appointments,
    newLeads,
    expiringMandates: db.expiringMandates,
    tasks: db.tasks.map((t) => ({ ...t, contact: t.contactId ? findContact(t.contactId) : undefined })),
  });
}

export type TaskWithRefs = Task & { contact?: Contact };

export async function toggleTask(id: ID) {
  const t = db.tasks.find((x) => x.id === id);
  if (t) t.done = !t.done;
  emitChange();
  return wait(t, 0);
}

/* ---------- Immobili ---------- */

export interface PropertyFilters {
  query?: string;
  contract?: Contract | "tutti";
  status?: PropertyStatus | "tutti";
  zone?: string;
}

export async function listProperties(f: PropertyFilters = {}) {
  const q = f.query?.trim().toLowerCase();
  const items = db.properties.filter((p) => {
    if (f.contract && f.contract !== "tutti" && p.contract !== f.contract) return false;
    if (f.status && f.status !== "tutti" && p.status !== f.status) return false;
    if (f.zone && f.zone !== "tutte" && p.zone !== f.zone) return false;
    if (q && !`${p.title} ${p.address} ${p.city} ${p.zone}`.toLowerCase().includes(q)) return false;
    return true;
  });
  return wait(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function listZones() {
  return [...new Set(db.properties.map((p) => p.zone))].sort();
}

export interface PropertyDetail {
  property: Property;
  owner?: Contact;
  matchingBuyers: Contact[];
}

export async function getProperty(id: ID): Promise<PropertyDetail | null> {
  const property = findProperty(id);
  if (!property) return wait(null);
  return wait({
    property,
    owner: findContact(property.ownerId),
    matchingBuyers: matchingBuyers(property),
  });
}

/** Acquirenti la cui ricerca è compatibile con l'immobile */
function matchingBuyers(p: Property) {
  return db.contacts.filter(
    (c) =>
      c.role === "acquirente" &&
      c.search &&
      c.search.contract === p.contract &&
      c.search.budgetMax >= p.price * 0.9 &&
      c.search.sqmMin <= p.sqm &&
      (c.search.zones.includes(p.zone) || c.proposedPropertyIds.includes(p.id)),
  );
}

export type NewProperty = Omit<Property, "id" | "agencyId" | "stats" | "createdAt" | "tint" | "ownerId"> & {
  owner: { firstName: string; lastName: string; phone: string };
};

export async function createProperty(input: NewProperty) {
  const owner: Contact = {
    id: newId("c"),
    agencyId: agency.id,
    ...input.owner,
    role: "proprietario",
    temperature: "tiepido",
    activities: [{ id: newId("a"), kind: "nota", text: "Nuovo incarico inserito", date: new Date().toISOString() }],
    proposedPropertyIds: [],
    createdAt: new Date().toISOString(),
  };
  const { owner: _owner, ...data } = input;
  void _owner;
  const property: Property = {
    ...data,
    id: newId("p"),
    agencyId: agency.id,
    ownerId: owner.id,
    tint: Math.floor(Math.random() * 360),
    stats: { views: 0, contacts: 0, onlineSince: new Date().toISOString() },
    createdAt: new Date().toISOString(),
  };
  db.contacts.push(owner);
  db.properties.push(property);
  emitChange();
  return wait(property, 600);
}

/* ---------- Contatti ---------- */

export async function listContacts(role?: ContactRole) {
  const items = db.contacts
    .filter((c) => !role || c.role === role)
    .map((c) => ({ ...c, lastActivity: [...c.activities].sort((a, b) => b.date.localeCompare(a.date))[0] }));
  return wait(items.sort((a, b) => (b.lastActivity?.date ?? "").localeCompare(a.lastActivity?.date ?? "")));
}

export interface ContactDetail {
  contact: Contact;
  proposed: Property[];
  owned: Property[];
}

export async function getContact(id: ID): Promise<ContactDetail | null> {
  const contact = findContact(id);
  if (!contact) return wait(null);
  return wait({
    contact: { ...contact, activities: [...contact.activities].sort((a, b) => b.date.localeCompare(a.date)) },
    proposed: contact.proposedPropertyIds.map(findProperty).filter((p): p is Property => !!p),
    owned: db.properties.filter((p) => p.ownerId === contact.id),
  });
}

export type NewContact = Pick<Contact, "firstName" | "lastName" | "phone" | "email" | "role" | "temperature" | "search">;

export async function createContact(input: NewContact) {
  const contact: Contact = {
    ...input,
    id: newId("c"),
    agencyId: agency.id,
    activities: [{ id: newId("a"), kind: "nota", text: "Contatto aggiunto", date: new Date().toISOString() }],
    proposedPropertyIds: [],
    createdAt: new Date().toISOString(),
  };
  db.contacts.push(contact);
  emitChange();
  return wait(contact, 500);
}

export function logActivity(contactId: ID, kind: "chiamata" | "whatsapp", text: string) {
  const c = findContact(contactId);
  if (!c) return;
  c.activities.push({ id: newId("a"), kind, text, date: new Date().toISOString() });
  emitChange();
}

/* ---------- Trattative ---------- */

export type DealWithRefs = Deal & { contact?: Contact; property?: Property };

export async function listDeals(): Promise<DealWithRefs[]> {
  return wait(db.deals.map((d) => ({ ...d, contact: findContact(d.contactId), property: findProperty(d.propertyId) })));
}

export async function moveDeal(id: ID, stage: DealStage) {
  const d = db.deals.find((x) => x.id === id);
  if (d) {
    d.stage = stage;
    d.updatedAt = new Date().toISOString();
  }
  emitChange();
  return wait(d, 0);
}

export async function createDeal(input: { contactId: ID; propertyId: ID }) {
  const property = findProperty(input.propertyId);
  const deal: Deal = {
    id: newId("d"),
    agencyId: agency.id,
    ...input,
    stage: "nuovo",
    // Per gli affitti il valore è il canone annuo
    value: property ? (property.contract === "affitto" ? property.price * 12 : property.price) : 0,
    updatedAt: new Date().toISOString(),
  };
  db.deals.push(deal);
  emitChange();
  return wait(deal, 400);
}

/* ---------- Agenda ---------- */

export type AppointmentWithRefs = Appointment & { contact?: Contact; property?: Property };

function withRefs(a: Appointment): AppointmentWithRefs {
  return { ...a, contact: findContact(a.contactId), property: findProperty(a.propertyId) };
}

export async function listAppointments(from: Date, to: Date) {
  const items = db.appointments
    .filter((a) => {
      const d = new Date(a.start);
      return d >= from && d < to;
    })
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(withRefs);
  return wait(items);
}

export async function createAppointment(input: {
  kind: AppointmentKind;
  start: string;
  contactId: ID;
  propertyId?: ID;
  note?: string;
}) {
  const appt: Appointment = { id: newId("e"), agencyId: agency.id, durationMin: 60, ...input };
  db.appointments.push(appt);
  emitChange();
  return wait(appt, 400);
}

/* ---------- Ricerca globale ---------- */

export interface SearchResults {
  properties: Property[];
  contacts: Contact[];
}

export async function searchAll(query: string): Promise<SearchResults> {
  const q = query.trim().toLowerCase();
  if (!q) return { properties: [], contacts: [] };
  return wait(
    {
      properties: db.properties
        .filter((p) => `${p.title} ${p.address} ${p.city} ${p.zone}`.toLowerCase().includes(q))
        .slice(0, 5),
      contacts: db.contacts
        .filter((c) => `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q))
        .slice(0, 5),
    },
    200,
  );
}

/** Liste leggere per i menu a tendina (scelta cliente / immobile) */
export function pickerOptions() {
  return {
    contacts: [...db.contacts].sort((a, b) => a.lastName.localeCompare(b.lastName)),
    properties: db.properties.filter((p) => p.status !== "venduto"),
  };
}
