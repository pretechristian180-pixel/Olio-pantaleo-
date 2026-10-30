/**
 * Livello dati delle Acquisizioni. Il cambio di fase passa solo da acquisition_set_phase()
 * (controlli lato server: motivo obbligatorio se persa, creazione dell'immobile all'incarico firmato).
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { NotAllowedError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { ID } from "@/types/domain";
import type { AcqPhase, Acquisition, AcquisitionPatch, LossReason } from "@/types/acquisitions";
import { canEdit } from "./api";
import { emitChange } from "./events";

// La tabella non è nei tipi generati di src/types/database.ts: client senza tipi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function ok<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

const SELECT = "*, owner:contacts(id, nome, cognome, telefono)";

function toAcquisition(r: Row): Acquisition {
  return {
    id: r.id,
    agentId: r.agente_id,
    contactId: r.contact_id,
    owner: r.owner ? { id: r.owner.id, firstName: r.owner.nome, lastName: r.owner.cognome, phone: r.owner.telefono } : undefined,
    address: r.indirizzo,
    city: r.citta ?? "",
    zone: r.zona ?? "",
    kind: r.tipo_immobile,
    sqm: r.mq_stimati,
    askingPrice: r.prezzo_richiesto == null ? null : Number(r.prezzo_richiesto),
    valuedPrice: r.prezzo_valutato == null ? null : Number(r.prezzo_valutato),
    source: r.fonte,
    phase: r.fase,
    phaseSince: r.fase_dal,
    lossReason: r.motivo_perdita,
    temperature: r.temperatura,
    nextAction: r.prossima_azione ?? "",
    nextActionDate: r.prossima_azione_data,
    propertyId: r.property_id,
    notes: r.note ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    canEdit: canEdit(r.agente_id),
  };
}

export async function listAcquisitions(): Promise<Acquisition[]> {
  return (ok(await db.from("acquisitions").select(SELECT).order("updated_at", { ascending: false })) as Row[]).map(toAcquisition);
}

export async function getAcquisition(id: ID): Promise<Acquisition | null> {
  const r = ok(await db.from("acquisitions").select(SELECT).eq("id", id).maybeSingle()) as Row | null;
  return r ? toAcquisition(r) : null;
}

/** Inserimento rapido: indirizzo, nome e telefono del proprietario (stesso telefono = stesso contatto) */
export async function quickAddAcquisition(input: { address: string; ownerName: string; phone: string }): Promise<ID> {
  const id = ok(await db.rpc("acquisition_quick_add", { p_indirizzo: input.address, p_nome: input.ownerName, p_telefono: input.phone })) as string;
  emitChange();
  return id;
}

export async function updateAcquisition(id: ID, p: AcquisitionPatch) {
  const cols: Row = {};
  if (p.address !== undefined) cols.indirizzo = p.address.trim();
  if (p.city !== undefined) cols.citta = p.city.trim() || null;
  if (p.zone !== undefined) cols.zona = p.zone.trim() || null;
  if (p.kind !== undefined) cols.tipo_immobile = p.kind;
  if (p.sqm !== undefined) cols.mq_stimati = p.sqm;
  if (p.askingPrice !== undefined) cols.prezzo_richiesto = p.askingPrice;
  if (p.valuedPrice !== undefined) cols.prezzo_valutato = p.valuedPrice;
  if (p.source !== undefined) cols.fonte = p.source;
  if (p.temperature !== undefined) cols.temperatura = p.temperature;
  if (p.nextAction !== undefined) cols.prossima_azione = p.nextAction.trim() || null;
  if (p.nextActionDate !== undefined) cols.prossima_azione_data = p.nextActionDate;
  if (p.notes !== undefined) cols.note = p.notes.trim() || null;
  if (p.agentId !== undefined) cols.agente_id = p.agentId;
  if (p.contactId !== undefined) cols.contact_id = p.contactId;
  const rows = ok(await db.from("acquisitions").update(cols).eq("id", id).select("id")) as Row[];
  if (!rows.length) throw new NotAllowedError();
  emitChange();
}

/** Collega un proprietario nuovo (nome e telefono) a un'acquisizione che non lo ha */
export async function addOwner(id: ID, name: string, phone: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const c = ok(
    await db.from("contacts").insert({ nome: first, cognome: rest.join(" "), telefono: phone.trim() || null, tipo: "proprietario" }).select("id").single(),
  ) as Row;
  await updateAcquisition(id, { contactId: c.id });
}

/** Cambia fase. Restituisce l'id dell'immobile creato quando l'incarico è firmato. */
export async function setAcquisitionPhase(id: ID, phase: AcqPhase, reason?: LossReason): Promise<ID | null> {
  const pid = ok(await db.rpc("acquisition_set_phase", { p_id: id, p_fase: phase, p_motivo: reason ?? null })) as string | null;
  emitChange();
  return pid ?? null;
}

export async function deleteAcquisition(id: ID) {
  ok(await db.from("acquisitions").delete().eq("id", id));
  emitChange();
}

/** Per la schermata Oggi: acquisizioni aperte con prossima azione scaduta o di oggi */
export async function acquisitionsToFollow(): Promise<Acquisition[]> {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const rows = ok(
    await db
      .from("acquisitions")
      .select(SELECT)
      .not("fase", "in", "(incarico_firmato,persa)")
      .lte("prossima_azione_data", today)
      .order("prossima_azione_data"),
  ) as Row[];
  return rows.map(toAcquisition);
}
