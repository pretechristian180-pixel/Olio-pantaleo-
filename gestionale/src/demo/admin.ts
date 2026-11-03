/**
 * Pannello admin con dati di esempio, solo per l'anteprima pubblicata.
 * Stesse funzioni di src/services/admin.ts.
 */
import type { AdminAgency, AdminAutomation, AdminUser, AutomationPreset } from "../services/admin";
import { addDays } from "@/lib/format";
import type { ID, Plan, Role } from "@/types/domain";
import { emitChange } from "@/services/events";

export type { AdminAgency, AdminAutomation, AdminUser, AutomationPreset };

const wait = <T,>(v: T, ms = 300) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const giorni = (n: number) => addDays(new Date(), -n).toISOString();

let agencies: AdminAgency[] = [
  { id: "ag_levante", name: "Immobiliare Levante", plan: "pro", active: true, email: "info@immobiliarelevante.it", phone: "080 521 4400", address: "Via Sparano 10, Bari", createdAt: giorni(60), users: 2, activeUsers: 2, properties: 9, contacts: 14, ownerName: "Giuseppe Lorusso", ownerEmail: "giuseppe@immobiliarelevante.it", lastActivity: giorni(0) },
  { id: "ag_esempio_2", name: "Agenzia di esempio 2", plan: "start", active: true, email: null, phone: null, address: null, createdAt: giorni(20), users: 1, activeUsers: 1, properties: 3, contacts: 5, ownerName: "Titolare di esempio", ownerEmail: "titolare@esempio.it", lastActivity: giorni(3) },
  { id: "ag_esempio_3", name: "Agenzia di esempio 3", plan: "elite", active: false, email: null, phone: null, address: null, createdAt: giorni(90), users: 4, activeUsers: 4, properties: 0, contacts: 0, ownerName: "Titolare di esempio", ownerEmail: "titolare3@esempio.it", lastActivity: null },
];

const users = new Map<ID, AdminUser[]>([
  ["ag_levante", [
    { id: "u_1", firstName: "Giuseppe", lastName: "Lorusso", email: "giuseppe@immobiliarelevante.it", role: "titolare", active: true, createdAt: giorni(60), lastSignIn: giorni(0), pending: false },
    { id: "u_2", firstName: "Claudia", lastName: "Colapietro", email: "claudia@immobiliarelevante.it", role: "agente", active: true, createdAt: giorni(30), lastSignIn: null, pending: true },
  ]],
]);

const refresh = (id: ID) => {
  const list = users.get(id) ?? [];
  agencies = agencies.map((a) => (a.id === id ? { ...a, users: list.length || a.users, activeUsers: list.filter((u) => u.active).length || a.activeUsers } : a));
};

export async function checkPlatformAdmin() {
  return true;
}
export async function listAgencies() {
  return wait([...agencies]);
}
export async function getAgency(id: ID) {
  return wait(agencies.find((a) => a.id === id) ?? null);
}
export async function listAgencyUsers(agencyId: ID) {
  return wait([...(users.get(agencyId) ?? [])]);
}
export async function updateAgencyAdmin(id: ID, input: { name: string; plan: Plan; email: string; phone: string; address: string; active: boolean }) {
  agencies = agencies.map((a) => (a.id === id ? { ...a, ...input, email: input.email || null, phone: input.phone || null, address: input.address || null } : a));
  emitChange();
}
export async function setUserAdmin(userId: ID, role: Role, active: boolean) {
  users.forEach((list, aid) => {
    const u = list.find((x) => x.id === userId);
    if (!u) return;
    if ((role !== "titolare" || !active) && u.role === "titolare" && !list.some((x) => x.id !== userId && x.role === "titolare" && x.active)) {
      throw new Error("L'agenzia deve avere almeno un titolare attivo: nomina prima un altro titolare");
    }
    u.role = role;
    u.active = active;
    refresh(aid);
  });
  emitChange();
}
const RECIPES: [string, string, string, string, boolean][] = [
  ["lead_benvenuto", "Rispondiamo subito ai nuovi contatti", "Quando arriva un lead, gli scriviamo subito su WhatsApp.", "whatsapp", true],
  ["lead_non_richiamato", "Avvisiamo il titolare se un lead non viene richiamato", "Dopo 2 ore lavorative senza risposta, il titolare riceve un avviso.", "notifica_interna", true],
  ["promemoria_visita", "Ricordiamo la visita al cliente il giorno prima", "Promemoria su WhatsApp con data, ora e indirizzo.", "whatsapp", true],
  ["feedback_visita", "Il giorno dopo la visita chiediamo com'è andata", "Breve questionario al cliente dopo la visita.", "whatsapp", true],
  ["report_proprietario", "Ogni 15 giorni aggiorniamo il proprietario", "Email con il link al report PDF.", "email", true],
  ["immobile_fermo", "Ti avvisiamo se un immobile non riceve visite da 21 giorni", "Promemoria all'agente per rivedere prezzo o foto.", "notifica_interna", true],
  ["incarico_scadenza", "Ti ricordiamo di rinnovare gli incarichi", "30 giorni prima della scadenza.", "task", true],
  ["acquisizione_ferma", "Ti ricordiamo di seguire le valutazioni fatte", "Dopo 3 giorni in \"Valutazione fatta\".", "task", true],
  ["documenti_rogito", "Ti ricordiamo i documenti prima della firma", "20 giorni prima della firma.", "task", true],
  ["dopo_rogito", "Dopo il rogito chiediamo una recensione", "Il giorno dopo il rogito.", "whatsapp", false],
  ["compleanno", "Facciamo gli auguri di compleanno", "Solo ai contatti con consenso.", "whatsapp", false],
  ["festivita_natale", "Facciamo gli auguri di Natale", "Solo ai contatti con consenso.", "whatsapp", false],
  ["festivita_pasqua", "Facciamo gli auguri di Pasqua", "Solo ai contatti con consenso.", "whatsapp", false],
  ["cliente_non_sentito", "Ti ricordiamo i clienti che non senti da 30 giorni", "Promemoria \"Risentilo\" all'agente.", "task", true],
  ["immobili_compatibili", "Mandiamo al cliente gli immobili giusti per lui", "Segnaliamo su WhatsApp gli immobili compatibili.", "whatsapp", false],
];
const autos = new Map<ID, { enabled: boolean; automations: AdminAutomation[] }>();
const autosOf = (aid: ID) => {
  if (!autos.has(aid))
    autos.set(aid, { enabled: true, automations: RECIPES.map(([recipe, name, description, action, active]) => ({ id: `${aid}_${recipe}`, name, description, action, active, locked: false, recipe })) });
  return autos.get(aid)!;
};
export async function getAgencyAutomations(agencyId: ID) {
  const a = autosOf(agencyId);
  return wait({ enabled: a.enabled, automations: a.automations.map((x) => ({ ...x })) });
}
export async function setAgencyAutomationsEnabled(agencyId: ID, enabled: boolean) {
  autosOf(agencyId).enabled = enabled;
  emitChange();
}
export async function setAutomationAdmin(id: ID, active: boolean, locked: boolean) {
  for (const v of autos.values()) {
    const x = v.automations.find((a) => a.id === id);
    if (x) Object.assign(x, { active, locked });
  }
  emitChange();
}
export async function applyAutomationPreset(agencyId: ID, preset: AutomationPreset) {
  const a = autosOf(agencyId);
  a.enabled = preset !== "spente";
  if (preset === "solo_promemoria") a.automations.forEach((x) => (x.active = ["task", "notifica_interna"].includes(x.action)));
  if (preset === "consigliate") a.automations.forEach((x) => (x.active = RECIPES.find((r) => r[0] === x.recipe)?.[4] ?? false));
  emitChange();
}
export async function createAgencyAdmin(input: { name: string; plan: Plan; phone: string; owner: { firstName: string; lastName: string; email: string }; automations?: AutomationPreset }) {
  const id = `ag_${Math.random().toString(36).slice(2, 8)}`;
  const owner: AdminUser = { id: `u_${id}`, firstName: input.owner.firstName, lastName: input.owner.lastName, email: input.owner.email, role: "titolare", active: true, createdAt: new Date().toISOString(), lastSignIn: null, pending: true };
  users.set(id, [owner]);
  if (input.automations) await applyAutomationPreset(id, input.automations);
  agencies = [{ id, name: input.name, plan: input.plan, active: true, email: input.owner.email, phone: input.phone || null, address: null, createdAt: new Date().toISOString(), users: 1, activeUsers: 1, properties: 0, contacts: 0, ownerName: `${input.owner.firstName} ${input.owner.lastName}`.trim(), ownerEmail: input.owner.email, lastActivity: null }, ...agencies];
  emitChange();
  return wait(id, 500);
}
export async function inviteUserAdmin(agencyId: ID, input: { firstName: string; lastName: string; email: string; role: Role }) {
  const list = users.get(agencyId) ?? [];
  list.push({ id: `u_${Math.random().toString(36).slice(2, 8)}`, firstName: input.firstName, lastName: input.lastName, email: input.email, role: input.role, active: true, createdAt: new Date().toISOString(), lastSignIn: null, pending: true });
  users.set(agencyId, list);
  refresh(agencyId);
  emitChange();
  return wait(undefined, 500);
}
export async function resendInviteAdmin(_email: string) {
  void _email;
  return wait(undefined, 400);
}
