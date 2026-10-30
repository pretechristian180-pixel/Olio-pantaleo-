/**
 * Livello di accesso ai dati: tutte le schermate passano da qui.
 * Legge e scrive su Supabase; la separazione tra agenzie e i permessi
 * (titolare / agente) sono garantiti dalle policy RLS sul database,
 * quindi qui non serve filtrare per agency_id.
 */
import type { PostgrestError } from "@supabase/supabase-js";
import { NotAllowedError } from "@/lib/errors";
import { daysSince, startOfDay, addDays } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { LOGO_BUCKET, PHOTO_BUCKET, supabase } from "@/lib/supabase";
import type { Tables } from "@/types/database";
import type {
  Activity,
  Agency,
  Agent,
  Appointment,
  AppointmentKind,
  Contact,
  ContactRole,
  ContactSource,
  Contract,
  Deal,
  DealStage,
  ID,
  Invitation,
  Match,
  MatchStatus,
  Property,
  PropertyKind,
  PropertyStats,
  PropertyStatus,
  SearchCriteria,
  Task,
  Temperature,
  Zone,
} from "@/types/domain";
import { emitChange } from "./events";

/* ---------- Utente collegato (impostato da AuthProvider) ---------- */

let me = { userId: "", agencyId: "", isOwner: false };

export function setCurrentUser(u: typeof me) {
  me = u;
}

/** Il titolare modifica tutto; l'agente solo ciò che è assegnato a lui. */
export function canEdit(agentId: ID | null | undefined) {
  return me.isOwner || agentId === me.userId;
}

/** Risultato di una query: lancia l'errore se c'è, altrimenti restituisce i dati. */
function ok<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

/** Come ok(), per le query che possono non trovare nulla (maybeSingle). */
function okMaybe<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw res.error;
  return res.data;
}

/** Testo sicuro per i filtri `or(...)` di PostgREST */
function likeTerm(q: string) {
  return q.replace(/[,()*%\\]/g, " ").trim();
}

/* ---------- Conversione righe → oggetti dell'interfaccia ---------- */

type PhotoRow = Pick<Tables<"property_photos">, "id" | "url" | "ordine">;
type PropertyRow = Tables<"properties"> & { property_photos?: PhotoRow[] | null };
type ContactRow = Tables<"contacts"> & { search_criteria?: Tables<"search_criteria"> | Tables<"search_criteria">[] | null };

function tintFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function toProperty(r: PropertyRow, signed: Map<string, string>): Property {
  const photos = [...(r.property_photos ?? [])]
    .sort((a, b) => a.ordine - b.ordine)
    .map((ph) => ({ id: ph.id, path: ph.url, url: signed.get(ph.url), scene: "esterno" as const }));
  return {
    id: r.id,
    agencyId: r.agency_id,
    agentId: r.agente_id,
    kind: r.tipo,
    title: r.titolo,
    address: r.indirizzo,
    city: r.citta,
    zone: r.zona ?? r.citta,
    contract: r.contratto,
    status: r.stato,
    price: Number(r.prezzo),
    sqm: r.mq,
    rooms: r.locali,
    bathrooms: r.bagni,
    floor: r.piano ?? undefined,
    energyClass: r.classe_energetica ?? undefined,
    description: r.descrizione ?? "",
    photos: photos.length ? photos : [{ id: `${r.id}_segnaposto`, scene: "esterno" }],
    ownerId: r.owner_id,
    mandateStart: r.data_incarico,
    mandateEnd: r.scadenza_incarico,
    tint: tintFor(r.id),
    createdAt: r.created_at,
  };
}

function toSearch(sc: Tables<"search_criteria">): SearchCriteria {
  return {
    zones: sc.zone ?? [],
    budgetMin: sc.budget_min,
    budgetMax: sc.budget_max,
    sqmMin: sc.mq_min,
    roomsMin: sc.locali_min,
    contract: sc.contratto,
    kind: sc.tipo,
  };
}

function toContact(r: ContactRow): Contact {
  const sc = Array.isArray(r.search_criteria) ? r.search_criteria[0] : r.search_criteria;
  return {
    id: r.id,
    agencyId: r.agency_id,
    agentId: r.agente_id,
    firstName: r.nome,
    lastName: r.cognome,
    phone: r.telefono ?? "",
    email: r.email ?? undefined,
    role: r.tipo,
    temperature: r.temperatura,
    source: r.fonte,
    notes: r.note ?? undefined,
    search: sc ? toSearch(sc) : undefined,
    createdAt: r.created_at,
  };
}

function toDeal(r: Tables<"deals">): Deal {
  return {
    id: r.id,
    agencyId: r.agency_id,
    agentId: r.agente_id,
    contactId: r.contact_id,
    propertyId: r.property_id,
    stage: r.fase,
    value: Number(r.valore ?? 0),
    commission: r.provvigione_prevista,
    updatedAt: r.updated_at,
  };
}

function toAppointment(r: Tables<"appointments">): Appointment {
  return {
    id: r.id,
    agencyId: r.agency_id,
    agentId: r.agente_id,
    kind: r.tipo,
    start: r.inizio,
    end: r.fine,
    durationMin: Math.max(15, Math.round((new Date(r.fine).getTime() - new Date(r.inizio).getTime()) / 60000)),
    contactId: r.contact_id,
    propertyId: r.property_id ?? undefined,
    note: r.note ?? undefined,
    outcome: r.esito ?? undefined,
  };
}

function toActivity(r: Pick<Tables<"activities">, "id" | "tipo" | "descrizione" | "created_at">): Activity {
  return { id: r.id, kind: r.tipo, text: r.descrizione, date: r.created_at };
}

/** Link temporanei (1 ora) per mostrare le foto del bucket privato */
async function signPhotos(paths: string[]) {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return map;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(unique, 3600);
  data?.forEach((d) => d.signedUrl && d.path && map.set(d.path, d.signedUrl));
  return map;
}

const PROPERTY_SELECT = "*, property_photos(id, url, ordine)";

async function propertiesWithCover(rows: PropertyRow[]) {
  const covers = rows.map((r) => [...(r.property_photos ?? [])].sort((a, b) => a.ordine - b.ordine)[0]?.url).filter(Boolean) as string[];
  const signed = await signPhotos(covers);
  return rows.map((r) => toProperty(r, signed));
}

const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* =====================================================================
 * Sessione, agenzia, squadra
 * ===================================================================== */

export async function loadSession(userId: string): Promise<{ agent: Agent; agency: Agency } | null> {
  const profile = okMaybe(await supabase.from("profiles").select("*").eq("id", userId).maybeSingle());
  if (!profile) return null;
  const agency = okMaybe(await supabase.from("agencies").select("*").eq("id", profile.agency_id).maybeSingle());
  if (!agency) return null;
  return { agent: toAgent(profile), agency: toAgency(agency) };
}

function toAgent(p: Tables<"profiles">): Agent {
  return {
    id: p.id,
    agencyId: p.agency_id,
    firstName: p.nome,
    lastName: p.cognome,
    phone: p.telefono,
    role: p.ruolo,
    active: p.attivo,
  };
}

function toAgency(a: Tables<"agencies">): Agency {
  return {
    id: a.id,
    name: a.nome,
    logoPath: a.logo_url,
    phone: a.telefono,
    email: a.email,
    address: a.indirizzo,
    plan: a.piano,
  };
}

export async function updateAgency(input: Pick<Agency, "name" | "phone" | "email" | "address">) {
  const rows = ok(
    await supabase
      .from("agencies")
      .update({ nome: input.name, telefono: input.phone, email: input.email, indirizzo: input.address })
      .eq("id", me.agencyId)
      .select("id"),
  );
  if (!rows?.length) throw new NotAllowedError();
}

export async function uploadAgencyLogo(file: File) {
  const blob = await compressImage(file, 600, 0.9);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : blob.type === "image/svg+xml" ? "svg" : "jpg";
  const path = `${me.agencyId}/logo-${Date.now()}.${ext}`;
  const up = await supabase.storage.from(LOGO_BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg" });
  if (up.error) throw up.error;
  const rows = ok(await supabase.from("agencies").update({ logo_url: path }).eq("id", me.agencyId).select("id"));
  if (!rows?.length) throw new NotAllowedError();
  return path;
}

export async function logoUrl(path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function updateMyProfile(input: { firstName: string; lastName: string; phone: string }) {
  const rows = ok(
    await supabase
      .from("profiles")
      .update({ nome: input.firstName, cognome: input.lastName, telefono: input.phone || null })
      .eq("id", me.userId)
      .select("id"),
  );
  if (!rows?.length) throw new NotAllowedError();
}

export async function listTeam(): Promise<{ members: Agent[]; invitations: Invitation[] }> {
  const [profiles, invites] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    me.isOwner
      ? supabase.from("invitations").select("*").is("accepted_at", null).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Tables<"invitations">[], error: null }),
  ]);
  return {
    members: ok(profiles).map(toAgent),
    invitations: ok(invites).map((i) => ({
      id: i.id,
      email: i.email,
      firstName: i.nome,
      lastName: i.cognome,
      createdAt: i.created_at,
      acceptedAt: i.accepted_at,
    })),
  };
}

export async function inviteAgent(input: { email: string; firstName: string; lastName: string }) {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("invita-agente", {
    body: { ...input, redirectTo: `${window.location.origin}/imposta-password` },
  });
  if (error) {
    // La funzione risponde con un messaggio già in italiano
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new Error(body?.error ?? "Non sono riuscito a inviare l'invito. Riprova tra poco.");
  }
  if (data?.error) throw new Error(data.error);
  emitChange();
}

export async function cancelInvitation(id: ID) {
  ok(await supabase.from("invitations").delete().eq("id", id));
  emitChange();
}

export async function setAgentActive(id: ID, active: boolean) {
  const rows = ok(await supabase.from("profiles").update({ attivo: active }).eq("id", id).select("id"));
  if (!rows?.length) throw new NotAllowedError();
  emitChange();
}

export async function acceptInvitation() {
  await supabase.rpc("accept_my_invitation");
}

/* =====================================================================
 * Oggi
 * ===================================================================== */

export type TaskWithRefs = Task & { contact?: Contact };
export type AppointmentWithRefs = Appointment & { contact?: Contact; property?: Property };

export interface TodaySummary {
  appointments: AppointmentWithRefs[];
  newLeads: number;
  expiringMandates: number;
  tasks: TaskWithRefs[];
}

export async function getToday(): Promise<TodaySummary> {
  const now = new Date();
  const from = startOfDay(now);
  const to = addDays(from, 1);
  const today = todayISO();
  const in15 = addDays(from, 15).toISOString().slice(0, 10);
  const weekAgo = addDays(from, -7).toISOString();

  const [appointments, tasks, expiring, leads] = await Promise.all([
    listAppointments(from, to),
    supabase
      .from("tasks")
      .select("*, contact:contacts(*), property:properties(indirizzo, citta)")
      .eq("assegnato_a", me.userId)
      .or(`and(completato.eq.false,or(scadenza.is.null,scadenza.lte.${today})),scadenza.eq.${today}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .gte("scadenza_incarico", today)
      .lte("scadenza_incarico", in15)
      .in("stato", ["disponibile", "in_trattativa"]),
    supabase
      .from("contacts")
      .select("id")
      .in("tipo", ["acquirente", "entrambi"])
      .gte("created_at", weekAgo),
  ]);

  // Nuovi contatti della settimana che nessuno ha ancora chiamato
  const leadIds = ok(leads).map((l) => l.id);
  let newLeads = 0;
  if (leadIds.length) {
    const called = ok(
      await supabase.from("activities").select("contact_id").eq("tipo", "chiamata").in("contact_id", leadIds),
    );
    const calledSet = new Set(called.map((c) => c.contact_id));
    newLeads = leadIds.filter((id) => !calledSet.has(id)).length;
  }
  if (expiring.error) throw expiring.error;

  type TaskRow = Tables<"tasks"> & {
    contact: Tables<"contacts"> | null;
    property: Pick<Tables<"properties">, "indirizzo" | "citta"> | null;
  };
  return {
    appointments,
    newLeads,
    expiringMandates: expiring.count ?? 0,
    tasks: (ok(tasks) as unknown as TaskRow[]).map((t) => ({
      id: t.id,
      agencyId: t.agency_id,
      text: t.titolo,
      detail: t.property
        ? `${t.property.indirizzo}, ${t.property.citta}`
        : t.contact?.telefono
          ? `Telefono ${t.contact.telefono}`
          : undefined,
      contactId: t.contact_id ?? undefined,
      propertyId: t.property_id ?? undefined,
      dueDate: t.scadenza,
      done: t.completato,
      automatic: t.origine === "automatica",
      contact: t.contact ? toContact(t.contact) : undefined,
    })),
  };
}

export async function toggleTask(id: ID, done: boolean) {
  const rows = ok(await supabase.from("tasks").update({ completato: done }).eq("id", id).select("id"));
  if (!rows?.length) throw new NotAllowedError();
  emitChange();
}

/* =====================================================================
 * Immobili
 * ===================================================================== */

export interface PropertyFilters {
  query?: string;
  contract?: Contract | "tutti";
  status?: PropertyStatus | "tutti";
  zone?: string;
}

export async function listProperties(f: PropertyFilters = {}) {
  let q = supabase.from("properties").select(PROPERTY_SELECT).order("created_at", { ascending: false });
  if (f.contract && f.contract !== "tutti") q = q.eq("contratto", f.contract);
  if (f.status && f.status !== "tutti") q = q.eq("stato", f.status);
  if (f.zone && f.zone !== "tutte") q = q.eq("zona", f.zone);
  const term = likeTerm(f.query ?? "");
  if (term) q = q.or(`titolo.ilike.%${term}%,indirizzo.ilike.%${term}%,citta.ilike.%${term}%,zona.ilike.%${term}%`);
  return propertiesWithCover(ok(await q) as unknown as PropertyRow[]);
}

/* ---------- Zone dell'agenzia (lista unica per immobili e ricerche) ---------- */

export async function listZoneItems(): Promise<Zone[]> {
  const rows = ok(await supabase.from("zones").select("id, nome"));
  return rows.map((z) => ({ id: z.id, name: z.nome })).sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export async function listZones() {
  return (await listZoneItems()).map((z) => z.name);
}

/** Aggiunge una zona (se esiste già con un'altra grafia, restituisce quella esistente). */
export async function addZone(name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  const existing = (await listZoneItems()).find((z) => z.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing.name;
  ok(await supabase.from("zones").insert({ nome: clean }));
  emitChange();
  return clean;
}

export async function deleteZone(id: ID) {
  const rows = ok(await supabase.from("zones").delete().eq("id", id).select("id"));
  if (!rows.length) throw new NotAllowedError();
  emitChange();
}

/* ---------- Matching (calcolato dal database, vedi migrazione "matching") ---------- */

function toMatch(r: Tables<"matches">): Match {
  return {
    id: r.id,
    propertyId: r.property_id,
    contactId: r.contact_id,
    score: r.punteggio,
    reasons: r.motivi ?? [],
    status: r.stato,
    proposedAt: r.proposto_at,
  };
}

export type BuyerMatch = Match & { contact: Contact };
export type PropertyMatch = Match & { property: Property };

/** Cambia lo stato di un match: la cronologia del cliente la aggiorna il database. */
export async function setMatchStatus(id: ID, status: MatchStatus) {
  const rows = ok(await supabase.from("matches").update({ stato: status }).eq("id", id).select("id"));
  if (!rows.length) throw new NotAllowedError();
  emitChange();
}

export interface PropertyDetail {
  property: Property;
  owner?: Contact;
  matches: BuyerMatch[];
  stats: PropertyStats;
  canEdit: boolean;
}

export async function getProperty(id: ID): Promise<PropertyDetail | null> {
  const row = okMaybe(await supabase.from("properties").select(PROPERTY_SELECT).eq("id", id).maybeSingle()) as unknown as PropertyRow | null;
  if (!row) return null;
  const [signed, owner, matchRows, visits, deals] = await Promise.all([
    signPhotos((row.property_photos ?? []).map((p) => p.url)),
    row.owner_id
      ? supabase.from("contacts").select("*").eq("id", row.owner_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("matches").select("*, contact:contacts(*)").eq("property_id", id).order("punteggio", { ascending: false }),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("property_id", id).eq("tipo", "visita"),
    supabase.from("deals").select("id", { count: "exact", head: true }).eq("property_id", id),
  ]);
  const property = toProperty(row, signed);
  type MatchRow = Tables<"matches"> & { contact: Tables<"contacts"> | null };
  const buyers = (ok(matchRows) as unknown as MatchRow[])
    .filter((m) => m.contact)
    .map((m) => ({ ...toMatch(m), contact: toContact(m.contact!) }));
  const ownerRow = okMaybe(owner);
  return {
    property,
    owner: ownerRow ? toContact(ownerRow) : undefined,
    matches: buyers,
    stats: { visits: visits.count ?? 0, deals: deals.count ?? 0, daysOnline: daysSince(property.createdAt) },
    canEdit: canEdit(property.agentId),
  };
}

export interface NewProperty {
  kind: PropertyKind;
  contract: Contract;
  title: string;
  address: string;
  city: string;
  zone: string;
  sqm: number;
  rooms: number;
  bathrooms: number;
  price: number;
  description: string;
  mandateEnd: string | null;
  photos: File[];
  owner: { firstName: string; lastName: string; phone: string };
}

/**
 * Crea proprietario, immobile e foto. Restituisce anche quante foto
 * non è stato possibile caricare, così l'interfaccia può avvisare.
 */
export async function createProperty(input: NewProperty) {
  const owner = ok(
    await supabase
      .from("contacts")
      .insert({
        nome: input.owner.firstName,
        cognome: input.owner.lastName,
        telefono: input.owner.phone,
        tipo: "proprietario",
      })
      .select("id")
      .single(),
  );

  const row = ok(
    await supabase
      .from("properties")
      .insert({
        tipo: input.kind,
        contratto: input.contract,
        titolo: input.title,
        indirizzo: input.address,
        citta: input.city,
        zona: input.zone || input.city,
        mq: input.sqm || null,
        locali: input.rooms || null,
        bagni: input.bathrooms || null,
        prezzo: input.price,
        descrizione: input.description || null,
        owner_id: owner.id,
        data_incarico: todayISO(),
        scadenza_incarico: input.mandateEnd,
      })
      .select("*")
      .single(),
  );

  let failedPhotos = 0;
  for (const [i, file] of input.photos.entries()) {
    try {
      const blob = await compressImage(file);
      const path = `${row.agency_id}/${row.id}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      ok(await supabase.from("property_photos").insert({ property_id: row.id, url: path, ordine: i }));
    } catch {
      failedPhotos++;
    }
  }

  emitChange();
  return { property: toProperty(row, new Map()), failedPhotos };
}

/** Aggiunge foto a un immobile esistente (es. appena nato da un'acquisizione). Restituisce quante non sono andate. */
export async function addPropertyPhotos(propertyId: ID, files: File[]) {
  const row = ok(await supabase.from("properties").select("agency_id, property_photos(ordine)").eq("id", propertyId).single()) as unknown as {
    agency_id: string;
    property_photos: { ordine: number }[];
  };
  let next = Math.max(-1, ...row.property_photos.map((p) => p.ordine)) + 1;
  let failed = 0;
  for (const file of files) {
    try {
      const blob = await compressImage(file);
      const path = `${row.agency_id}/${propertyId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      ok(await supabase.from("property_photos").insert({ property_id: propertyId, url: path, ordine: next++ }));
    } catch {
      failed++;
    }
  }
  emitChange();
  return { failed };
}

/* =====================================================================
 * Contatti
 * ===================================================================== */

export type ContactWithLast = Contact & { lastActivity?: Activity };

export async function listContacts(): Promise<ContactWithLast[]> {
  const [contacts, acts] = await Promise.all([
    supabase.from("contacts").select("*, search_criteria(*)").order("updated_at", { ascending: false }),
    supabase
      .from("activities")
      .select("id, tipo, descrizione, created_at, contact_id")
      .not("contact_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  const last = new Map<string, Activity>();
  ok(acts).forEach((a) => {
    if (a.contact_id && !last.has(a.contact_id)) last.set(a.contact_id, toActivity(a));
  });
  return (ok(contacts) as unknown as ContactRow[])
    .map((c) => ({ ...toContact(c), lastActivity: last.get(c.id) }))
    .sort((a, b) => (b.lastActivity?.date ?? b.createdAt).localeCompare(a.lastActivity?.date ?? a.createdAt));
}

export interface ContactDetail {
  contact: Contact & { activities: Activity[] };
  /** Immobili compatibili non ancora proposti */
  matches: PropertyMatch[];
  /** Immobili già proposti (con il matching, in trattativa o in visita) */
  proposed: (Property & { match?: Match })[];
  owned: Property[];
  canEdit: boolean;
}

export async function getContact(id: ID): Promise<ContactDetail | null> {
  const row = okMaybe(await supabase.from("contacts").select("*, search_criteria(*)").eq("id", id).maybeSingle()) as unknown as ContactRow | null;
  if (!row) return null;
  const [acts, deals, appts, owned, matchRows] = await Promise.all([
    supabase.from("activities").select("id, tipo, descrizione, created_at").eq("contact_id", id).order("created_at", { ascending: false }),
    supabase.from("deals").select("property_id").eq("contact_id", id).not("property_id", "is", null),
    supabase.from("appointments").select("property_id").eq("contact_id", id).not("property_id", "is", null),
    supabase.from("properties").select(PROPERTY_SELECT).eq("owner_id", id),
    supabase
      .from("matches")
      .select(`*, property:properties(${PROPERTY_SELECT})`)
      .eq("contact_id", id)
      .neq("stato", "scartato")
      .order("punteggio", { ascending: false }),
  ]);
  type MatchRow = Tables<"matches"> & { property: PropertyRow | null };
  const matchList = (ok(matchRows) as unknown as MatchRow[]).filter((m) => m.property);
  const matchProps = await propertiesWithCover(matchList.map((m) => m.property!));
  const withProps = matchList.map((m, i) => ({ ...toMatch(m), property: matchProps[i] }));
  // Immobili proposti: quelli collegati alle sue trattative o ai suoi appuntamenti
  const proposedByMatch = withProps.filter((m) => m.status !== "da_proporre");
  const proposedIds = [...new Set([...ok(deals), ...ok(appts)].map((r) => r.property_id as string))].filter(
    (pid) => !proposedByMatch.some((m) => m.propertyId === pid),
  );
  const proposedRows = proposedIds.length
    ? (ok(await supabase.from("properties").select(PROPERTY_SELECT).in("id", proposedIds)) as unknown as PropertyRow[])
    : [];
  const contact = toContact(row);
  return {
    contact: { ...contact, activities: ok(acts).map(toActivity) },
    matches: withProps.filter((m) => m.status === "da_proporre"),
    proposed: [
      ...proposedByMatch.map(({ property, ...match }) => ({ ...property, match })),
      ...(await propertiesWithCover(proposedRows)),
    ],
    owned: await propertiesWithCover(ok(owned) as unknown as PropertyRow[]),
    canEdit: canEdit(contact.agentId),
  };
}

export interface NewContact {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: ContactRole;
  temperature: Temperature;
  source: ContactSource | null;
  search?: { zones: string[]; budgetMax: number | null; sqmMin: number | null; contract: Contract };
}

export async function createContact(input: NewContact) {
  const row = ok(
    await supabase
      .from("contacts")
      .insert({
        nome: input.firstName,
        cognome: input.lastName,
        telefono: input.phone,
        email: input.email || null,
        tipo: input.role,
        temperatura: input.temperature,
        fonte: input.source,
      })
      .select("*")
      .single(),
  );
  if (input.search && input.role !== "proprietario") {
    ok(
      await supabase.from("search_criteria").insert({
        contact_id: row.id,
        contratto: input.search.contract,
        zone: input.search.zones,
        budget_max: input.search.budgetMax,
        mq_min: input.search.sqmMin,
      }),
    );
  }
  emitChange();
  return toContact(row);
}

/** Registra nella cronologia una chiamata o un messaggio WhatsApp. */
export async function logActivity(contactId: ID, kind: "chiamata" | "whatsapp", text: string) {
  const { error } = await supabase.from("activities").insert({ contact_id: contactId, tipo: kind, descrizione: text });
  if (!error) emitChange();
}

/* =====================================================================
 * Trattative
 * ===================================================================== */

export type DealWithRefs = Deal & { contact?: Contact; property?: Property; canEdit: boolean };

export async function listDeals(): Promise<DealWithRefs[]> {
  type Row = Tables<"deals"> & { contact: Tables<"contacts"> | null; property: PropertyRow | null };
  const rows = ok(
    await supabase
      .from("deals")
      .select("*, contact:contacts(*), property:properties(*)")
      .neq("fase", "persa")
      .order("updated_at", { ascending: false }),
  ) as unknown as Row[];
  return rows.map((r) => ({
    ...toDeal(r),
    contact: r.contact ? toContact(r.contact) : undefined,
    property: r.property ? toProperty(r.property, new Map()) : undefined,
    canEdit: canEdit(r.agente_id),
  }));
}

export async function moveDeal(id: ID, stage: DealStage) {
  // La cronologia ("cambio fase") e il promemoria dopo la visita li crea il database
  const rows = ok(await supabase.from("deals").update({ fase: stage }).eq("id", id).select("id"));
  if (!rows?.length) throw new NotAllowedError();
  emitChange();
}

export async function createDeal(input: { contactId: ID; propertyId: ID }) {
  const property = ok(await supabase.from("properties").select("prezzo, contratto").eq("id", input.propertyId).single());
  // Per gli affitti il valore è il canone annuo
  const value = property.contratto === "affitto" ? Number(property.prezzo) * 12 : Number(property.prezzo);
  const row = ok(
    await supabase
      .from("deals")
      .insert({ contact_id: input.contactId, property_id: input.propertyId, valore: value })
      .select("*")
      .single(),
  );
  emitChange();
  return toDeal(row);
}

/* =====================================================================
 * Agenda
 * ===================================================================== */

/** Appuntamenti dell'utente collegato tra due date */
export async function listAppointments(from: Date, to: Date): Promise<AppointmentWithRefs[]> {
  type Row = Tables<"appointments"> & { contact: Tables<"contacts"> | null; property: PropertyRow | null };
  const rows = ok(
    await supabase
      .from("appointments")
      .select("*, contact:contacts(*), property:properties(*)")
      .eq("agente_id", me.userId)
      .gte("inizio", from.toISOString())
      .lt("inizio", to.toISOString())
      .order("inizio"),
  ) as unknown as Row[];
  return rows.map((r) => ({
    ...toAppointment(r),
    contact: r.contact ? toContact(r.contact) : undefined,
    property: r.property ? toProperty(r.property, new Map()) : undefined,
  }));
}

export async function createAppointment(input: {
  kind: AppointmentKind;
  start: string;
  contactId: ID;
  propertyId?: ID;
  note?: string;
}) {
  const end = new Date(new Date(input.start).getTime() + 60 * 60000).toISOString();
  // La riga in cronologia ("Fissato appuntamento…") la crea il database
  const row = ok(
    await supabase
      .from("appointments")
      .insert({
        tipo: input.kind,
        inizio: input.start,
        fine: end,
        contact_id: input.contactId,
        property_id: input.propertyId ?? null,
        note: input.note ?? null,
      })
      .select("*")
      .single(),
  );
  emitChange();
  return toAppointment(row);
}

/* =====================================================================
 * Ricerca globale e menu a tendina
 * ===================================================================== */

export interface SearchResults {
  properties: Property[];
  contacts: Contact[];
}

export async function searchAll(query: string): Promise<SearchResults> {
  const t = likeTerm(query);
  if (!t) return { properties: [], contacts: [] };
  const [props, contacts] = await Promise.all([
    supabase
      .from("properties")
      .select(PROPERTY_SELECT)
      .or(`titolo.ilike.%${t}%,indirizzo.ilike.%${t}%,citta.ilike.%${t}%,zona.ilike.%${t}%`)
      .limit(5),
    supabase
      .from("contacts")
      .select("*")
      .or(`nome.ilike.%${t}%,cognome.ilike.%${t}%,telefono.ilike.%${t}%,email.ilike.%${t}%`)
      .limit(5),
  ]);
  return {
    properties: await propertiesWithCover(ok(props) as unknown as PropertyRow[]),
    contacts: ok(contacts).map((c) => toContact(c)),
  };
}

export async function pickerOptions() {
  const [contacts, properties] = await Promise.all([
    supabase.from("contacts").select("*").order("cognome"),
    supabase.from("properties").select("*").in("stato", ["disponibile", "in_trattativa"]).order("indirizzo"),
  ]);
  return {
    contacts: ok(contacts).map((c) => toContact(c)),
    properties: ok(properties).map((p) => toProperty(p, new Map())),
  };
}
