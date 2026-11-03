/**
 * Pannello admin della piattaforma: gestione di tutte le agenzie.
 * Le letture e le modifiche passano da funzioni del database riservate agli amministratori
 * (migrazione "admin_piattaforma"); creazione agenzie e inviti dalla Edge Function "admin-piattaforma".
 */
import { supabase } from "@/lib/supabase";
import type { ID, Plan, Role } from "@/types/domain";
import { emitChange } from "./events";

export interface AdminAgency {
  id: ID;
  name: string;
  plan: Plan;
  active: boolean;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  users: number;
  activeUsers: number;
  properties: number;
  contacts: number;
  ownerName: string | null;
  ownerEmail: string | null;
  lastActivity: string | null;
}

export interface AdminUser {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  lastSignIn: string | null;
  pending: boolean;
}

export async function checkPlatformAdmin() {
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
}

export async function listAgencies(): Promise<AdminAgency[]> {
  const { data, error } = await supabase.rpc("admin_list_agencies");
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.nome,
    plan: a.piano,
    active: a.attiva,
    email: a.email,
    phone: a.telefono,
    address: a.indirizzo,
    createdAt: a.created_at,
    users: a.utenti,
    activeUsers: a.utenti_attivi,
    properties: a.immobili,
    contacts: a.contatti,
    ownerName: a.titolare_nome,
    ownerEmail: a.titolare_email,
    lastActivity: a.ultima_attivita,
  }));
}

export async function getAgency(id: ID) {
  return (await listAgencies()).find((a) => a.id === id) ?? null;
}

export async function listAgencyUsers(agencyId: ID): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc("admin_agency_users", { aid: agencyId });
  if (error) throw error;
  return (data ?? []).map((u) => ({
    id: u.id,
    firstName: u.nome,
    lastName: u.cognome,
    email: u.email,
    role: u.ruolo,
    active: u.attivo,
    createdAt: u.created_at,
    lastSignIn: u.ultimo_accesso,
    pending: u.in_attesa,
  }));
}

export async function updateAgencyAdmin(
  id: ID,
  input: { name: string; plan: Plan; email: string; phone: string; address: string; active: boolean },
) {
  const { error } = await supabase.rpc("admin_update_agency", {
    aid: id,
    p_nome: input.name,
    p_piano: input.plan,
    p_email: input.email,
    p_telefono: input.phone,
    p_indirizzo: input.address,
    p_attiva: input.active,
  });
  if (error) throw error;
  emitChange();
}

export async function setUserAdmin(userId: ID, role: Role, active: boolean) {
  const { error } = await supabase.rpc("admin_set_user", { uid: userId, p_ruolo: role, p_attivo: active });
  if (error) throw error;
  emitChange();
}

/** Chiama la Edge Function e restituisce il messaggio d'errore già in italiano */
async function callAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string; agency_id?: string }>("admin-piattaforma", {
    body: { ...body, redirectTo: `${window.location.origin}/imposta-password` },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const res = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new Error(res?.error ?? "Operazione non riuscita. Riprova tra poco.");
  }
  if (data?.error) throw new Error(data.error);
  emitChange();
  return data;
}

export type AutomationPreset = "consigliate" | "solo_promemoria" | "spente";

export interface AdminAutomation {
  id: ID;
  name: string;
  description: string;
  active: boolean;
  locked: boolean;
  recipe: string | null;
  action: string;
}

// Funzioni aggiunte dopo la generazione dei tipi del database
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as any)(name, args) as Promise<{ data: any; error: Error | null }>;

/** Automazioni di un'agenzia: interruttore generale e ognuna con acceso/spento e "bloccata" */
export async function getAgencyAutomations(agencyId: ID): Promise<{ enabled: boolean; automations: AdminAutomation[] }> {
  const { data, error } = await rpc("admin_agency_automations", { aid: agencyId });
  if (error) throw error;
  return {
    enabled: data?.attive !== false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    automations: (data?.automazioni ?? []).map((a: any) => ({
      id: a.id,
      name: a.nome,
      description: a.descrizione ?? "",
      active: a.attiva,
      locked: a.bloccata,
      recipe: a.ricetta,
      action: a.azione,
    })),
  };
}

export async function setAgencyAutomationsEnabled(agencyId: ID, enabled: boolean) {
  const { error } = await rpc("admin_set_agency_automations", { aid: agencyId, p_attive: enabled });
  if (error) throw error;
  emitChange();
}

export async function setAutomationAdmin(id: ID, active: boolean, locked: boolean) {
  const { error } = await rpc("admin_set_automation", { p_id: id, p_attiva: active, p_bloccata: locked });
  if (error) throw error;
  emitChange();
}

export async function applyAutomationPreset(agencyId: ID, preset: AutomationPreset) {
  const { error } = await rpc("admin_apply_automation_preset", { aid: agencyId, p_preset: preset });
  if (error) throw error;
  emitChange();
}

export async function createAgencyAdmin(input: {
  name: string;
  plan: Plan;
  phone: string;
  owner: { firstName: string; lastName: string; email: string };
  automations?: AutomationPreset;
}) {
  const res = await callAdmin({
    azione: "crea_agenzia",
    nome: input.name,
    piano: input.plan,
    telefono: input.phone,
    titolare: { nome: input.owner.firstName, cognome: input.owner.lastName, email: input.owner.email },
  });
  const id = res?.agency_id as string | undefined;
  // Le ricette si installano con l'agenzia: poi si applica la scelta fatta nel modulo
  if (id && input.automations && input.automations !== "consigliate") await applyAutomationPreset(id, input.automations);
  return id;
}

export async function inviteUserAdmin(agencyId: ID, input: { firstName: string; lastName: string; email: string; role: Role }) {
  await callAdmin({ azione: "invita_utente", agency_id: agencyId, nome: input.firstName, cognome: input.lastName, email: input.email, ruolo: input.role });
}

export async function resendInviteAdmin(email: string) {
  await callAdmin({ azione: "reinvia_invito", email });
}
