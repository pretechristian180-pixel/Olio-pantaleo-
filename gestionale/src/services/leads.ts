/**
 * Livello dati dei Lead. Lettura con RLS (titolare: tutti; agente: i propri).
 * Ogni scrittura passa da funzioni del database; l'ingresso dei lead dalla Edge Function "lead-ingresso".
 * I token di Facebook non passano mai di qui: il collegamento avviene tra Facebook e la funzione.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Lead, LeadAssignment, LeadIntake, LeadSettings, LeadState, LeadStats } from "@/types/leads";
import { emitChange } from "./events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function ok<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

const SELECT = "*, agente:profiles!leads_agente_id_agency_id_fkey(nome, cognome), immobile:properties!leads_property_id_agency_id_fkey(titolo, indirizzo)";

const toLead = (r: Row): Lead => ({
  id: r.id,
  contactId: r.contact_id,
  agentId: r.agente_id,
  agentName: r.agente ? `${r.agente.nome} ${r.agente.cognome}`.trim() : null,
  propertyId: r.property_id,
  propertyLabel: r.immobile ? r.immobile.indirizzo || r.immobile.titolo : null,
  channel: r.canale,
  portal: r.portale,
  firstName: r.nome,
  lastName: r.cognome,
  phone: r.telefono,
  email: r.email,
  message: r.messaggio,
  reference: r.riferimento,
  score: r.punteggio,
  reasons: r.motivi ?? [],
  state: r.stato,
  lostReason: r.motivo_perso,
  firstContactAt: r.primo_contatto_at,
  repeated: r.ripetuto,
  createdAt: r.created_at,
});

export async function listLeads(): Promise<Lead[]> {
  return (ok(await db.from("leads").select(SELECT).order("created_at", { ascending: false }).limit(300)) as Row[]).map(toLead);
}

export async function getLead(id: string): Promise<Lead> {
  return toLead(ok(await db.from("leads").select(SELECT).eq("id", id).single()));
}

export async function leadStats(): Promise<LeadStats> {
  const s = ok(await db.rpc("lead_statistiche")) as Row;
  return {
    total: s.totale,
    byChannel: s.per_canale ?? {},
    medianResponseMinutes: s.risposta_minuti,
    withinHour: s.entro_un_ora,
    appointments: s.appuntamenti,
    toHandle: s.da_gestire,
  };
}

export async function markContacted(id: string, channel: "chiamata" | "whatsapp" | "email") {
  ok(await db.rpc("lead_segna_contattato", { p_lead: id, p_canale: channel }));
  emitChange();
}

export async function setLeadState(id: string, state: Extract<LeadState, "nuovo" | "contattato" | "perso" | "spam">, reason?: string) {
  ok(await db.rpc("lead_cambia_stato", { p_lead: id, p_stato: state, p_motivo: reason ?? null }));
  emitChange();
}

export async function assignLead(id: string, agentId: string) {
  ok(await db.rpc("lead_assegna", { p_lead: id, p_agente: agentId }));
  emitChange();
}

export async function getLeadSettings(): Promise<LeadSettings> {
  const [s, pages] = await Promise.all([
    db.from("lead_settings").select("assegnazione, agenti_rotazione").maybeSingle(),
    db.from("lead_sources").select("id, nome, instagram, stato").neq("stato", "scollegata").order("collegata_at"),
  ]);
  const row = ok(s) as Row | null;
  return {
    assignment: (row?.assegnazione ?? "agente_immobile") as LeadAssignment,
    rotation: row?.agenti_rotazione ?? [],
    pages: (ok(pages) as Row[]).map((p) => ({ id: p.id, name: p.nome, instagram: p.instagram, state: p.stato })),
  };
}

export async function saveLeadSettings(assignment: LeadAssignment, rotation: string[]) {
  ok(await db.rpc("lead_salva_impostazioni", { p_assegnazione: assignment, p_agenti: rotation }));
  emitChange();
}

export async function getIntake(): Promise<LeadIntake> {
  const { data, error } = await supabase.functions.invoke("lead-ingresso", { body: { azione: "stato" } });
  if (error) throw error;
  return { token: data.token, formUrl: data.indirizzo_modulo, email: data.email, metaReady: data.meta_attivo, aiEmail: data.ai_email };
}

/** Indirizzo di Facebook per collegare le pagine (il ritorno lo gestisce la funzione) */
export async function startMetaConnect(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("lead-ingresso", { body: { azione: "meta_avvia" } });
  if (error) throw error;
  return data.url as string;
}

export async function disconnectPage(id: string) {
  ok(await db.rpc("lead_meta_scollega", { p_id: id }));
  emitChange();
}

export async function sendTestLead() {
  ok(await db.rpc("lead_prova"));
  emitChange();
}
