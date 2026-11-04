/**
 * Attività e squadra. Le cose da fare: l'agente vede le sue e quelle che ha dato ai colleghi, il titolare tutte (RLS).
 * Il cruscotto viene da squadra_cruscotto(): il titolare vede tutti, l'agente solo i propri numeri.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AgentStats, NewTask, TaskState, TeamTask } from "@/types/team";
import { emitChange } from "./events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
function ok<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}
const name = (p: Row | null) => (p ? `${p.nome ?? ""} ${p.cognome ?? ""}`.trim() || null : null);

const SELECT =
  "*, assegnato:profiles!tasks_assegnato_a_agency_id_fkey(nome, cognome), creatore:profiles!tasks_creato_da_fkey(nome, cognome), contatto:contacts(nome, cognome), immobile:properties(indirizzo)";

const toTask = (r: Row): TeamTask => ({
  id: r.id,
  title: r.titolo,
  note: r.note,
  state: r.stato,
  priority: r.priorita,
  dueDate: r.scadenza,
  assigneeId: r.assegnato_a,
  assigneeName: name(r.assegnato),
  creatorId: r.creato_da,
  creatorName: name(r.creatore),
  contactId: r.contact_id,
  contactName: name(r.contatto),
  propertyId: r.property_id,
  propertyLabel: r.immobile?.indirizzo ?? null,
  automatic: r.origine === "automatica",
  doneAt: r.completato_at,
  createdAt: r.created_at,
});

export type TaskScope = { kind: "mie" } | { kind: "date_da_me" } | { kind: "tutte" } | { kind: "agente"; id: string };

export async function listTasks(scope: TaskScope, me: string, done: boolean): Promise<TeamTask[]> {
  let q = db.from("tasks").select(SELECT).eq("completato", done);
  if (scope.kind === "mie") q = q.eq("assegnato_a", me);
  else if (scope.kind === "date_da_me") q = q.eq("creato_da", me).neq("assegnato_a", me);
  else if (scope.kind === "agente") q = q.eq("assegnato_a", scope.id);
  q = done ? q.order("completato_at", { ascending: false }).limit(60) : q.order("scadenza", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(200);
  return (ok(await q) as Row[]).map(toTask);
}

export async function createTask(t: NewTask) {
  ok(
    await db.from("tasks").insert({
      titolo: t.title.trim(),
      assegnato_a: t.assigneeId,
      scadenza: t.dueDate,
      priorita: t.priority,
      note: t.note?.trim() || null,
      contact_id: t.contactId || null,
      property_id: t.propertyId || null,
      origine: "manuale",
    }),
  );
  emitChange();
}

export async function updateTask(id: string, patch: Partial<{ state: TaskState; title: string; assigneeId: string; dueDate: string | null; priority: "normale" | "alta"; note: string | null }>) {
  const row: Row = {};
  if (patch.state) row.stato = patch.state;
  if (patch.title !== undefined) row.titolo = patch.title.trim();
  if (patch.assigneeId) row.assegnato_a = patch.assigneeId;
  if (patch.dueDate !== undefined) row.scadenza = patch.dueDate;
  if (patch.priority) row.priorita = patch.priority;
  if (patch.note !== undefined) row.note = patch.note?.trim() || null;
  const rows = ok(await db.from("tasks").update(row).eq("id", id).select("id")) as Row[];
  if (!rows.length) throw new Error("Non puoi modificare questa cosa da fare");
  emitChange();
}

export async function deleteTask(id: string) {
  ok(await db.from("tasks").delete().eq("id", id));
  emitChange();
}

export async function teamDashboard(days: number): Promise<AgentStats[]> {
  const rows = ok(await db.rpc("squadra_cruscotto", { p_giorni: days })) as Row[];
  return rows
    .map((r) => ({
      agentId: r.agente_id,
      name: r.nome || "Titolare",
      role: r.ruolo,
      calls: r.chiamate,
      messages: r.messaggi,
      visits: r.visite,
      upcoming: r.appuntamenti_prossimi,
      newContacts: r.nuovi_contatti,
      leads: r.lead,
      leadResponseMinutes: r.lead_risposta_minuti,
      mandates: r.incarichi,
      offers: r.proposte,
      closings: r.rogiti,
      tasksDone: r.cose_fatte,
      tasksOpen: r.cose_aperte,
      tasksLate: r.cose_in_ritardo,
      lastActivity: r.ultima_attivita,
    }))
    .sort((a, b) => Number(b.role === "titolare") - Number(a.role === "titolare") || a.name.localeCompare(b.name));
}
