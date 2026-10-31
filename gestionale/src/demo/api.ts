/**
 * Versione "anteprima" del livello dati: stesse funzioni di src/services/api.ts,
 * ma con dati di esempio in memoria. Si usa solo nella pagina di anteprima pubblicata
 * (`npm run anteprima`), che non può collegarsi a Supabase.
 * Le modifiche restano finché non si ricarica la pagina.
 */
import type {
  ContactPatch,
  PropertyPatch,
  AppointmentWithRefs,
  ContactDetail,
  ContactWithLast,
  DealWithRefs,
  NewContact,
  NewProperty,
  PropertyDetail,
  PropertyFilters,
  SearchResults,
  TaskWithRefs,
  TodaySummary,
} from "../services/api";
import { addDays, daysSince, startOfDay } from "@/lib/format";
import { evaluateMatch } from "@/lib/matching";
import type {
  Activity,
  Agency,
  Agent,
  Appointment,
  AppointmentKind,
  Contact,
  Deal,
  DealStage,
  ID,
  Invitation,
  Match,
  MatchStatus,
  Property,
  PropertyKind,
  SearchCriteria,
  Task,
  Zone,
} from "@/types/domain";
import { emitChange } from "@/services/events";
import * as legacy from "./legacy";

export type {
  AppointmentWithRefs,
  ContactDetail,
  ContactWithLast,
  DealWithRefs,
  NewContact,
  NewProperty,
  PropertyDetail,
  PropertyFilters,
  SearchResults,
  TaskWithRefs,
  TodaySummary,
};

const wait = <T,>(value: T, ms = 350) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const AG = legacy.agency.id as string;
const ME = legacy.currentAgent.id as string;

/* ---------- Conversione dei dati di esempio nel modello attuale ---------- */

const kindMap: Record<string, PropertyKind> = {
  appartamento: "appartamento",
  attico: "appartamento",
  villa: "villa",
  casa: "villa",
  trullo: "villa",
  masseria: "villa",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = {
  agency: { id: AG, name: legacy.agency.name, logoPath: null, phone: "080 521 4400", email: "info@immobiliarelevante.it", address: "Via Sparano 10, Bari", plan: "pro" } as Agency,
  team: [
    { id: ME, agencyId: AG, firstName: legacy.currentAgent.firstName, lastName: legacy.currentAgent.lastName, phone: legacy.currentAgent.phone, role: "titolare", active: true },
    { id: "u_2", agencyId: AG, firstName: "Claudia", lastName: "Colapietro", phone: "340 552 0911", role: "agente", active: true },
  ] as Agent[],
  invitations: [] as Invitation[],
  properties: legacy.properties.map(
    (p: any): Property => ({
      id: p.id,
      agencyId: AG,
      agentId: ME,
      kind: kindMap[p.kind] ?? "altro",
      title: p.title,
      address: p.address,
      city: p.city,
      zone: p.zone,
      contract: p.contract,
      status: p.status === "trattativa" ? "in_trattativa" : p.status,
      price: p.price,
      sqm: p.sqm,
      rooms: p.rooms,
      bathrooms: p.bathrooms,
      floor: p.floor,
      energyClass: p.energyClass,
      description: p.description,
      photos: p.photos,
      ownerId: p.ownerId,
      mandateStart: p.createdAt.slice(0, 10),
      mandateEnd: ["p3", "p8"].includes(p.id) ? addDays(new Date(), p.id === "p3" ? 3 : 12).toISOString().slice(0, 10) : null,
      features: p.id === "p1" ? ["balcone", "ascensore", "aria condizionata", "doppi servizi", "ristrutturato"] : p.id === "p2" ? ["terrazzo", "vista mare"] : [],
      tint: p.tint,
      createdAt: p.createdAt,
    }),
  ),
  contacts: legacy.contacts.map(
    (c: any): Contact => ({
      id: c.id,
      agencyId: AG,
      agentId: ME,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      role: c.role,
      temperature: c.temperature,
      source: c.role === "acquirente" ? "portale" : null,
      search: c.search
        ? { id: `sc_${c.id}`, active: true, features: [], zones: c.search.zones, budgetMin: null, budgetMax: c.search.budgetMax, sqmMin: c.search.sqmMin, roomsMin: null, contract: c.search.contract, kind: null }
        : undefined,
      tags: c.role === "acquirente" ? ["prima casa"] : [],
      birthday: null,
      marketingConsent: false,
      createdAt: c.createdAt,
    }),
  ),
  activities: new Map<string, Activity[]>(
    legacy.contacts.map((c: any) => [c.id, c.activities.map((a: any) => ({ ...a, kind: a.kind === "proposta" ? "nota" : a.kind }))]),
  ),
  proposed: new Map<string, string[]>(legacy.contacts.map((c: any) => [c.id, c.proposedPropertyIds])),
  deals: legacy.deals.map((d: any): Deal => ({ ...d, agencyId: AG, agentId: ME, commission: null })),
  appointments: legacy.appointments.map(
    (a: any): Appointment => ({
      ...a,
      agencyId: AG,
      agentId: ME,
      end: new Date(new Date(a.start).getTime() + a.durationMin * 60000).toISOString(),
    }),
  ),
  tasks: legacy.tasks.map(
    (t: any): Task => ({ ...t, agencyId: AG, dueDate: new Date().toISOString().slice(0, 10), automatic: true }),
  ),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

db.contacts.forEach((c) => (c.searches = c.search ? [c.search] : []));

const findContact = (id?: ID | null) => db.contacts.find((c) => c.id === id);
const findProperty = (id?: ID | null) => db.properties.find((p) => p.id === id);
const addActivity = (contactId: ID, kind: Activity["kind"], text: string) =>
  db.activities.set(contactId, [{ id: newId("a"), kind, text, date: new Date().toISOString() }, ...(db.activities.get(contactId) ?? [])]);

/* ---------- Sessione, agenzia, squadra ---------- */

export function setCurrentUser(_u: { userId: string; agencyId: string; isOwner: boolean }) {
  void _u;
}

export function canEdit(_agentId: ID | null | undefined) {
  void _agentId;
  return true;
}

export async function loadSession(_userId: string) {
  void _userId;
  return { agent: db.team[0], agency: db.agency };
}

export async function updateAgency(input: Pick<Agency, "name" | "phone" | "email" | "address">) {
  Object.assign(db.agency, input);
  return wait(undefined, 300);
}

export async function uploadAgencyLogo(_file: File) {
  void _file;
  throw new Error("Nell'anteprima non si possono caricare file.");
}

export async function logoUrl(_path: string | null) {
  void _path;
  return null;
}

export async function updateMyProfile(input: { firstName: string; lastName: string; phone: string }) {
  Object.assign(db.team[0], input);
  return wait(undefined, 300);
}

export async function listTeam() {
  return wait({ members: db.team, invitations: db.invitations });
}

export async function inviteAgent(input: { email: string; firstName: string; lastName: string }) {
  db.invitations.unshift({ id: newId("i"), email: input.email, firstName: input.firstName, lastName: input.lastName, createdAt: new Date().toISOString(), acceptedAt: null });
  emitChange();
  return wait(undefined, 500);
}

export async function cancelInvitation(id: ID) {
  db.invitations = db.invitations.filter((i) => i.id !== id);
  emitChange();
}

export async function setAgentActive(id: ID, active: boolean) {
  const m = db.team.find((x) => x.id === id);
  if (m) m.active = active;
  emitChange();
}

export async function acceptInvitation() {}

/* ---------- Oggi ---------- */

export async function getToday(): Promise<TodaySummary> {
  const today = new Date();
  const weekAgo = addDays(startOfDay(today), -7).toISOString();
  const in15 = addDays(startOfDay(today), 15).toISOString().slice(0, 10);
  const todayISO = today.toISOString().slice(0, 10);
  const tasks: TaskWithRefs[] = db.tasks.map((t) => ({ ...t, contact: findContact(t.contactId) }));
  return wait({
    appointments: await listAppointmentsNow(startOfDay(today), addDays(startOfDay(today), 1)),
    // Nei dati di esempio le chiamate in cronologia sono quelle ricevute: contiamo i nuovi acquirenti della settimana
    newLeads: db.contacts.filter((c) => c.role !== "proprietario" && c.createdAt >= weekAgo).length,
    expiringMandates: db.properties.filter((p) => p.mandateEnd && p.mandateEnd >= todayISO && p.mandateEnd <= in15).length,
    tasks,
  });
}

export async function toggleTask(id: ID, done: boolean) {
  const t = db.tasks.find((x) => x.id === id);
  if (t) t.done = done;
  emitChange();
}

/* ---------- Immobili ---------- */

export async function listProperties(f: PropertyFilters = {}) {
  const q = f.query?.trim().toLowerCase();
  return wait(
    db.properties
      .filter((p) => {
        if (f.contract && f.contract !== "tutti" && p.contract !== f.contract) return false;
        if (f.status && f.status !== "tutti" && p.status !== f.status) return false;
        if (f.zone && f.zone !== "tutte" && p.zone !== f.zone) return false;
        if (q && !`${p.title} ${p.address} ${p.city} ${p.zone}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

/* ---------- Zone e matching (stessa logica del database, vedi lib/matching.ts) ---------- */

let zones: Zone[] = [...new Set([...db.properties.map((p) => p.zone), ...db.contacts.flatMap((c) => c.search?.zones ?? [])])]
  .filter(Boolean)
  .map((name, i) => ({ id: `z${i}`, name }));

export async function listZoneItems() {
  return wait([...zones].sort((a, b) => a.name.localeCompare(b.name, "it")), 150);
}

export async function listZones() {
  return (await listZoneItems()).map((z) => z.name);
}

export async function addZone(name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  const existing = zones.find((z) => z.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing.name;
  zones.push({ id: newId("z"), name: clean });
  emitChange();
  return clean;
}

export async function deleteZone(id: ID) {
  zones = zones.filter((z) => z.id !== id);
  emitChange();
}

// Stato dei match (proposto, interessato, scartato); il punteggio si ricalcola a ogni lettura
const matchState = new Map<string, { id: string; status: MatchStatus; proposedAt: string | null }>();
// Vito Carofiglio (nuovo contatto di oggi) ha ancora un immobile "da proporre", così si vede il pulsante WhatsApp
db.proposed.forEach((pids, cid) =>
  pids.filter((pid) => !(cid === "c4" && pid === "p8")).forEach((pid) => matchState.set(`${pid}|${cid}`, { id: `m_${pid}_${cid}`, status: "proposto", proposedAt: addDays(new Date(), -2).toISOString() })),
);

function currentMatches(): Match[] {
  const out: Match[] = [];
  for (const p of db.properties) {
    for (const c of db.contacts) {
      const searches = (c.searches ?? (c.search ? [c.search] : [])).filter((x) => x.active !== false);
      if (!["acquirente", "entrambi", "inquilino"].includes(c.role) || !searches.length || c.id === p.ownerId) continue;
      const key = `${p.id}|${c.id}`;
      const state = matchState.get(key);
      const evaluation =
        p.status === "disponibile"
          ? searches.map((sc) => evaluateMatch(p, sc)).filter((e): e is NonNullable<typeof e> => !!e).sort((a, b) => b.score - a.score)[0] ?? null
          : null;
      if (!evaluation && !state) continue;
      const st = state ?? { id: `m_${p.id}_${c.id}`, status: "da_proporre" as const, proposedAt: null };
      out.push({ id: st.id, propertyId: p.id, contactId: c.id, score: evaluation?.score ?? 50, reasons: evaluation?.reasons ?? [], status: st.status, proposedAt: st.proposedAt });
    }
  }
  return out;
}

export async function setMatchStatus(id: ID, status: MatchStatus) {
  const m = currentMatches().find((x) => x.id === id);
  if (!m) return;
  const prev = matchState.get(`${m.propertyId}|${m.contactId}`);
  matchState.set(`${m.propertyId}|${m.contactId}`, {
    id,
    status,
    proposedAt: status === "proposto" ? new Date().toISOString() : (prev?.proposedAt ?? null),
  });
  const p = findProperty(m.propertyId);
  const what = p ? `${p.address}, ${p.city}` : "l'immobile";
  if (status === "proposto") addActivity(m.contactId, "whatsapp", `Proposto su WhatsApp: ${what}`);
  if (status === "interessato") addActivity(m.contactId, "nota", `Interessato a ${what}`);
  if (status === "scartato") addActivity(m.contactId, "nota", `Non interessato a ${what}`);
  emitChange();
}

export async function getProperty(id: ID): Promise<PropertyDetail | null> {
  const p = findProperty(id);
  if (!p) return wait(null);
  const matches = currentMatches()
    .filter((m) => m.propertyId === id)
    .map((m) => ({ ...m, contact: findContact(m.contactId)! }))
    .sort((a, b) => b.score - a.score);
  return wait({
    property: p,
    owner: findContact(p.ownerId),
    matches,
    stats: {
      visits: db.appointments.filter((a) => a.propertyId === id && a.kind === "visita").length,
      deals: db.deals.filter((d) => d.propertyId === id).length,
      daysOnline: daysSince(p.createdAt),
    },
    canEdit: true,
  });
}

export async function createProperty(input: NewProperty) {
  const owner: Contact = {
    id: newId("c"),
    agencyId: AG,
    agentId: ME,
    firstName: input.owner.firstName,
    lastName: input.owner.lastName,
    phone: input.owner.phone,
    role: "proprietario",
    temperature: "tiepido",
    source: null,
    createdAt: new Date().toISOString(),
  };
  const id = newId("p");
  const property: Property = {
    id,
    agencyId: AG,
    agentId: ME,
    kind: input.kind,
    title: input.title,
    address: input.address,
    city: input.city,
    zone: input.zone || input.city,
    contract: input.contract,
    status: "disponibile",
    price: input.price,
    sqm: input.sqm || null,
    rooms: input.rooms || null,
    bathrooms: input.bathrooms || null,
    description: input.description,
    photos: input.photos.length
      ? input.photos.map((f, i) => ({ id: `${id}_f${i}`, url: URL.createObjectURL(f), scene: "esterno" as const }))
      : [{ id: `${id}_f0`, scene: "esterno" }],
    ownerId: owner.id,
    mandateStart: new Date().toISOString().slice(0, 10),
    mandateEnd: input.mandateEnd,
    tint: Math.floor(Math.random() * 360),
    createdAt: new Date().toISOString(),
  };
  db.contacts.push(owner);
  db.properties.push(property);
  addActivity(owner.id, "nota", `Nuovo incarico: ${property.address}, ${property.city}`);
  emitChange();
  return wait({ property, failedPhotos: 0 }, 600);
}

export async function addPropertyPhotos(propertyId: ID, files: File[]) {
  const p = db.properties.find((x) => x.id === propertyId);
  if (p) {
    const real = p.photos.filter((ph) => ph.url);
    p.photos = [...(real.length ? p.photos : []), ...files.map((f, i) => ({ id: newId(`${propertyId}_f${i}`), url: URL.createObjectURL(f), scene: "esterno" as const }))];
  }
  emitChange();
  return wait({ failed: 0 }, 500);
}

/** Usate solo dai dati di esempio delle Acquisizioni (src/demo/acquisitions.ts) */
export const demoDb = {
  contacts: () => db.contacts,
  addContact: (c: Contact) => db.contacts.push(c),
  removeContacts: (ids: ID[]) => {
    db.contacts = db.contacts.filter((c) => !ids.includes(c.id));
  },
  agencyId: AG,
  me: ME,
  addProperty: (p: Property) => db.properties.push(p),
  addActivity: (contactId: ID, text: string) => addActivity(contactId, "nota", text),
  newId,
};

export async function updateContact(id: ID, p: ContactPatch) {
  const c = findContact(id);
  if (c)
    Object.assign(c, {
      firstName: p.firstName.trim(),
      lastName: p.lastName.trim(),
      phone: p.phone.trim(),
      email: p.email.trim() || undefined,
      role: p.role,
      temperature: p.temperature,
      source: p.source,
      tags: [...new Set(p.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
      birthday: p.birthday,
      marketingConsent: p.marketingConsent,
      notes: p.notes.trim() || undefined,
    });
  emitChange();
  return wait(undefined);
}

export async function saveSearch(contactId: ID, sc: SearchCriteria) {
  const c = findContact(contactId);
  if (!c) return;
  const list = c.searches ?? [];
  if (sc.id) {
    const i = list.findIndex((x) => x.id === sc.id);
    if (i >= 0) list[i] = { ...sc };
  } else list.push({ ...sc, id: newId("sc"), active: sc.active ?? true });
  c.searches = list;
  c.search = list.find((x) => x.active !== false);
  emitChange();
  return wait(undefined);
}

export async function deleteSearch(id: ID) {
  for (const c of db.contacts) {
    if (c.searches?.some((x) => x.id === id)) {
      c.searches = c.searches.filter((x) => x.id !== id);
      c.search = c.searches.find((x) => x.active !== false);
    }
  }
  emitChange();
  return wait(undefined);
}

export async function updateProperty(id: ID, p: PropertyPatch) {
  const pr = findProperty(id);
  if (pr)
    Object.assign(pr, {
      price: p.price,
      status: p.status,
      sqm: p.sqm,
      rooms: p.rooms,
      bathrooms: p.bathrooms,
      description: p.description,
      features: p.features,
      floor: p.floor || undefined,
      energyClass: p.energyClass || undefined,
      mandateEnd: p.mandateEnd,
    });
  emitChange();
  return wait(undefined);
}

/* ---------- Contatti ---------- */

export async function listContacts(): Promise<ContactWithLast[]> {
  return wait(
    db.contacts
      .map((c) => ({ ...c, lastActivity: [...(db.activities.get(c.id) ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0] }))
      .sort((a, b) => (b.lastActivity?.date ?? b.createdAt).localeCompare(a.lastActivity?.date ?? a.createdAt)),
  );
}

export async function getContact(id: ID): Promise<ContactDetail | null> {
  const c = findContact(id);
  if (!c) return wait(null);
  return wait({
    contact: { ...c, activities: [...(db.activities.get(id) ?? [])].sort((a, b) => b.date.localeCompare(a.date)) },
    matches: currentMatches()
      .filter((m) => m.contactId === id && m.status === "da_proporre")
      .map((m) => ({ ...m, property: findProperty(m.propertyId)! }))
      .sort((a, b) => b.score - a.score),
    proposed: currentMatches()
      .filter((m) => m.contactId === id && (m.status === "proposto" || m.status === "interessato"))
      .map(({ ...match }) => ({ ...findProperty(match.propertyId)!, match })),
    owned: db.properties.filter((p) => p.ownerId === id),
    canEdit: true,
  });
}

export async function createContact(input: NewContact) {
  const c: Contact = {
    id: newId("c"),
    agencyId: AG,
    agentId: ME,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    role: input.role,
    temperature: input.temperature,
    source: input.source,
    search: input.search
      ? { zones: input.search.zones, budgetMin: null, budgetMax: input.search.budgetMax, sqmMin: input.search.sqmMin, roomsMin: null, contract: input.search.contract, kind: null }
      : undefined,
    createdAt: new Date().toISOString(),
  };
  db.contacts.push(c);
  addActivity(c.id, "nota", "Contatto aggiunto");
  emitChange();
  return wait(c, 500);
}

export async function logActivity(contactId: ID, kind: "chiamata" | "whatsapp", text: string) {
  addActivity(contactId, kind, text);
  emitChange();
}

/* ---------- Trattative ---------- */

export async function listDeals(): Promise<DealWithRefs[]> {
  return wait(
    db.deals
      .filter((d) => d.stage !== "persa")
      .map((d) => ({ ...d, contact: findContact(d.contactId), property: findProperty(d.propertyId), canEdit: true })),
  );
}

export async function getDeal(id: ID): Promise<DealWithRefs | null> {
  const d = db.deals.find((x) => x.id === id);
  if (!d) return wait(null);
  return wait({ ...d, contact: findContact(d.contactId), property: findProperty(d.propertyId), canEdit: true });
}

export async function moveDeal(id: ID, stage: DealStage) {
  const d = db.deals.find((x) => x.id === id);
  if (d) {
    d.stage = stage;
    d.updatedAt = new Date().toISOString();
    addActivity(d.contactId, "cambio_fase", "Trattativa spostata di fase");
  }
  emitChange();
}

export async function createDeal(input: { contactId: ID; propertyId: ID }) {
  const p = findProperty(input.propertyId);
  const d: Deal = {
    id: newId("d"),
    agencyId: AG,
    agentId: ME,
    contactId: input.contactId,
    propertyId: input.propertyId,
    stage: "nuovo",
    value: p ? (p.contract === "affitto" ? p.price * 12 : p.price) : 0,
    commission: null,
    updatedAt: new Date().toISOString(),
  };
  db.deals.push(d);
  emitChange();
  return wait(d, 400);
}

/* ---------- Agenda ---------- */

function listAppointmentsNow(from: Date, to: Date): AppointmentWithRefs[] {
  return db.appointments
    .filter((a) => {
      const d = new Date(a.start);
      return d >= from && d < to;
    })
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => ({ ...a, contact: findContact(a.contactId), property: findProperty(a.propertyId) }));
}

export async function listAppointments(from: Date, to: Date) {
  return wait(listAppointmentsNow(from, to));
}

export async function createAppointment(input: { kind: AppointmentKind; start: string; contactId: ID; propertyId?: ID; note?: string }) {
  const a: Appointment = {
    id: newId("e"),
    agencyId: AG,
    agentId: ME,
    kind: input.kind,
    start: input.start,
    end: new Date(new Date(input.start).getTime() + 3600000).toISOString(),
    durationMin: 60,
    contactId: input.contactId,
    propertyId: input.propertyId,
    note: input.note,
  };
  db.appointments.push(a);
  addActivity(input.contactId, "nota", "Fissato un appuntamento");
  emitChange();
  return wait(a, 400);
}

/* ---------- Ricerca e menu a tendina ---------- */

export async function searchAll(query: string): Promise<SearchResults> {
  const q = query.trim().toLowerCase();
  if (!q) return { properties: [], contacts: [] };
  return wait(
    {
      properties: db.properties.filter((p) => `${p.title} ${p.address} ${p.city} ${p.zone}`.toLowerCase().includes(q)).slice(0, 5),
      contacts: db.contacts.filter((c) => `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q)).slice(0, 5),
    },
    200,
  );
}

export async function pickerOptions() {
  return wait({
    contacts: [...db.contacts].sort((a, b) => a.lastName.localeCompare(b.lastName)),
    properties: db.properties.filter((p) => p.status === "disponibile" || p.status === "in_trattativa"),
  }, 0);
}
