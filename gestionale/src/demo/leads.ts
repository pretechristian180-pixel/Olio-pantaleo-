/** Versione "anteprima" di src/services/leads.ts: lead di esempio in memoria. */
import { emitChange } from "@/services/events";
import type { Contact } from "@/types/domain";
import type { Lead, LeadAssignment, LeadIntake, LeadSettings, LeadState, LeadStats } from "@/types/leads";
import { demoDb } from "./api";

const wait = <T,>(value: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

type Seed = Omit<Lead, "id" | "contactId" | "agentName" | "propertyLabel" | "lostReason" | "firstContactAt" | "repeated" | "reference"> &
  Partial<Pick<Lead, "lostReason" | "firstContactAt" | "repeated" | "reference">>;

let leads: Lead[] | null = null;

function contactFor(s: Seed): string {
  const found = demoDb.contacts().find((c) => s.phone && c.phone.replace(/\D/g, "").endsWith(s.phone.replace(/\D/g, "").slice(-9)));
  if (found) return found.id;
  const c: Contact = {
    id: demoDb.newId("c_lead"), agencyId: demoDb.agencyId, agentId: s.agentId, firstName: s.firstName, lastName: s.lastName,
    phone: s.phone ?? "", email: s.email ?? undefined, role: /vend/i.test(s.message ?? "") ? "proprietario" : "acquirente",
    temperature: s.score >= 60 ? "caldo" : s.score >= 35 ? "tiepido" : "freddo",
    source: s.channel === "portale" ? "portale" : s.channel === "sito" ? "sito" : "social", notes: s.message ?? undefined, tags: [],
    createdAt: s.createdAt,
  };
  demoDb.addContact(c);
  return c.id;
}

function build(s: Seed, i: number): Lead {
  const team = demoDb.team();
  const agent = team.find((a) => a.id === s.agentId);
  const prop = s.propertyId ? demoDb.properties().find((p) => p.id === s.propertyId) : undefined;
  return {
    lostReason: null, firstContactAt: null, repeated: 1, reference: null, ...s,
    id: `lead_${i}`,
    contactId: contactFor(s),
    agentName: agent ? `${agent.firstName} ${agent.lastName}` : null,
    propertyLabel: prop ? prop.address : null,
  };
}

function all(): Lead[] {
  if (leads) return leads;
  const [me, claudia] = demoDb.team().map((a) => a.id);
  const [p1, p2] = demoDb.properties().map((p) => p.id);
  const seeds: Seed[] = [
    { channel: "portale", portal: "Immobiliare.it", firstName: "Francesca", lastName: "Lorusso", phone: "+39 3289917745", email: "francesca.lorusso@gmail.com",
      message: "Buongiorno, vorrei visitare l'appartamento questa settimana. Ho già il mutuo approvato.", score: 95,
      reasons: ["Ha lasciato il telefono", "Ha lasciato l'email", "Chiede di un immobile preciso", "Vuole visitare", "Pronto a comprare", "Messaggio dettagliato"],
      state: "nuovo", agentId: me, propertyId: p1, createdAt: ago(25) },
    { channel: "sito", portal: null, firstName: "Teresa", lastName: "De Marco", phone: "+39 3471208834", email: null,
      message: "Vorrei vendere il mio trilocale a Poggiofranco, mi fate una valutazione?", score: 75,
      reasons: ["Ha lasciato il telefono", "Vuole vendere: possibile incarico", "Messaggio dettagliato"], state: "nuovo", agentId: claudia, propertyId: null, createdAt: ago(70) },
    { channel: "facebook", portal: "Facebook", firstName: "Davide", lastName: "Amato", phone: "+39 3337765120", email: "davide.amato@libero.it",
      message: "budget: 200.000 €\nzona preferita: Carrassi", score: 40, reasons: ["Ha lasciato il telefono", "Ha lasciato l'email"],
      state: "nuovo", agentId: me, propertyId: null, createdAt: ago(190), reference: "Campagna Case a Carrassi" },
    { channel: "portale", portal: "Idealista", firstName: "Sara", lastName: "Mininni", phone: "+39 3405528871", email: "sara.mininni@gmail.com",
      message: "È ancora disponibile? Quando si può vedere?", score: 70, reasons: ["Ha lasciato il telefono", "Ha lasciato l'email", "Chiede di un immobile preciso", "Vuole visitare"],
      state: "contattato", agentId: claudia, propertyId: p2, createdAt: ago(60 * 26), firstContactAt: ago(60 * 25 + 40) },
    { channel: "sito", portal: null, firstName: "Giorgio", lastName: "Lattanzio", phone: "+39 3381904456", email: null,
      message: "Cerco un quadrilocale con box auto in zona Murat.", score: 50, reasons: ["Ha lasciato il telefono", "Messaggio dettagliato"],
      state: "appuntamento", agentId: me, propertyId: null, createdAt: ago(60 * 50), firstContactAt: ago(60 * 49 + 10), repeated: 2 },
    { channel: "instagram", portal: "Instagram", firstName: "Nicola", lastName: "Bux", phone: null, email: "nicola.bux@hotmail.it",
      message: null, score: 10, reasons: ["Ha lasciato l'email"], state: "perso", agentId: me, propertyId: null, createdAt: ago(60 * 24 * 4), lostReason: "Cerca solo in affitto" },
  ];
  leads = seeds.map(build);
  return leads;
}

let settings = { assignment: "agente_immobile" as LeadAssignment, rotation: [] as string[] };
let pages: LeadSettings["pages"] = [{ id: "pg1", name: "Immobiliare Levante", instagram: true, state: "collegata" }];

export async function listLeads() {
  return wait(all().map((l) => ({ ...l })));
}
export async function getLead(id: string) {
  const l = all().find((x) => x.id === id);
  if (!l) throw new Error("Lead non trovato");
  return wait({ ...l }, 150);
}
export async function leadStats(): Promise<LeadStats> {
  const l = all().filter((x) => x.state !== "spam");
  const byChannel: Record<string, number> = {};
  for (const x of l) byChannel[x.portal || x.channel] = (byChannel[x.portal || x.channel] ?? 0) + 1;
  return wait({ total: l.length, byChannel, medianResponseMinutes: 38, withinHour: 2, appointments: l.filter((x) => ["appuntamento", "acquisito"].includes(x.state)).length, toHandle: l.filter((x) => x.state === "nuovo").length });
}
export async function markContacted(id: string, _channel: "chiamata" | "whatsapp" | "email") {
  const l = all().find((x) => x.id === id);
  if (l) Object.assign(l, { firstContactAt: l.firstContactAt ?? new Date().toISOString(), state: l.state === "nuovo" ? "contattato" : l.state });
  emitChange();
}
export async function setLeadState(id: string, state: Extract<LeadState, "nuovo" | "contattato" | "perso" | "spam">, reason?: string) {
  const l = all().find((x) => x.id === id);
  if (l) Object.assign(l, { state, lostReason: state === "perso" ? reason ?? null : null });
  emitChange();
}
export async function assignLead(id: string, agentId: string) {
  const l = all().find((x) => x.id === id);
  const a = demoDb.team().find((x) => x.id === agentId);
  if (l && a) Object.assign(l, { agentId, agentName: `${a.firstName} ${a.lastName}` });
  emitChange();
}
export async function getLeadSettings(): Promise<LeadSettings> {
  return wait({ ...settings, pages });
}
export async function saveLeadSettings(assignment: LeadAssignment, rotation: string[]) {
  settings = { assignment, rotation };
  emitChange();
  return wait(undefined);
}
export async function getIntake(): Promise<LeadIntake> {
  return wait({ token: "a1b2c3d4e5f6a7b8c9", formUrl: "https://bwpgpsrcddlngpskyajr.supabase.co/functions/v1/lead-ingresso", email: "lead-a1b2c3d4e5f6a7b8c9@lead.mattonio.it", metaReady: true, aiEmail: true });
}
export async function startMetaConnect(): Promise<string> {
  throw new Error("Nell'anteprima il collegamento a Facebook non è attivo.");
}
export async function disconnectPage(id: string) {
  pages = pages.filter((p) => p.id !== id);
  emitChange();
}
export async function sendTestLead() {
  const [me] = demoDb.team().map((a) => a.id);
  all().unshift(build({ channel: "prova", portal: "Lead di prova", firstName: "Prova", lastName: "Mattonio", phone: `+39 333000${Math.floor(1000 + Math.random() * 8999)}`, email: null,
    message: "Buongiorno, vorrei visitare l'immobile questa settimana. Ho il mutuo già approvato.", score: 65,
    reasons: ["Ha lasciato il telefono", "Vuole visitare", "Pronto a comprare", "Messaggio dettagliato"], state: "nuovo", agentId: me, propertyId: null, createdAt: new Date().toISOString() }, Date.now()));
  emitChange();
}
