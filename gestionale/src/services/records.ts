/**
 * Archivio documenti, checklist e scheda della visita.
 * I file stanno nel bucket privato "documenti" ({agency_id}/{uuid}.{ext}); le regole di accesso sono nelle policy RLS.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { NotAllowedError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { ID } from "@/types/domain";
import type {
  ChecklistItem,
  ChecklistKind,
  ChecklistState,
  DocCategory,
  DocumentItem,
  PaperworkSummary,
  RecordRef,
  VisitFeedback,
  VisitFeedbackInput,
} from "@/types/records";
import { emitChange } from "./events";

// Tabelle non presenti nei tipi generati: client senza tipi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const DOCS_BUCKET = "documenti";

function ok<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

function refFilter(q: any, ref: RecordRef): any {
  if (ref.contactId) q = q.eq("contact_id", ref.contactId);
  if (ref.propertyId) q = q.eq("property_id", ref.propertyId);
  if (ref.dealId) q = q.eq("deal_id", ref.dealId);
  if (ref.acquisitionId) q = q.eq("acquisition_id", ref.acquisitionId);
  return q;
}

/* ---------- Documenti ---------- */

const toDoc = (r: Row): DocumentItem => ({
  id: r.id,
  category: r.categoria,
  name: r.nome,
  path: r.file_path,
  mime: r.mime,
  size: r.dimensione,
  expiresOn: r.scadenza,
  notes: r.note,
  uploadedBy: r.caricato_da,
  createdAt: r.created_at,
});

export async function listDocuments(ref: RecordRef): Promise<DocumentItem[]> {
  const q = refFilter(db.from("documents").select("*"), ref).order("created_at", { ascending: false });
  return (ok(await q) as Row[]).map(toDoc);
}

export async function uploadDocument(ref: RecordRef, file: File, meta: { category: DocCategory; name: string; expiresOn: string | null }) {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id ?? "";
  const prof = ok(await db.from("profiles").select("agency_id").eq("id", uid).single()) as Row;
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${prof.agency_id}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from(DOCS_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (up.error) throw up.error;
  const row = ok(
    await db
      .from("documents")
      .insert({
        contact_id: ref.contactId ?? null,
        property_id: ref.propertyId ?? null,
        deal_id: ref.dealId ?? null,
        acquisition_id: ref.acquisitionId ?? null,
        categoria: meta.category,
        nome: meta.name.trim() || file.name,
        file_path: path,
        mime: file.type || null,
        dimensione: file.size,
        scadenza: meta.expiresOn,
      })
      .select("*")
      .single(),
  ) as Row;
  emitChange();
  return toDoc(row);
}

export async function documentUrl(path: string) {
  const { data } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export async function deleteDocument(doc: DocumentItem) {
  const rows = ok(await db.from("documents").delete().eq("id", doc.id).select("id")) as Row[];
  if (!rows.length) throw new NotAllowedError();
  await supabase.storage.from(DOCS_BUCKET).remove([doc.path]);
  emitChange();
}

/* ---------- Checklist ---------- */

const toItem = (r: Row): ChecklistItem => ({
  id: r.id,
  kind: r.tipo,
  label: r.voce,
  help: r.aiuto,
  required: r.obbligatoria,
  state: r.stato,
  documentId: r.document_id,
  dueOn: r.scadenza,
  note: r.nota,
  doneBy: r.chi ? `${r.chi.nome} ${r.chi.cognome}`.trim() : null,
  doneAt: r.completato_at,
  order: r.ordine,
});

/** Restituisce la checklist e, se non esiste ancora, la prepara con le voci standard */
export async function getChecklist(ref: { propertyId?: ID; dealId?: ID }, kind: ChecklistKind): Promise<ChecklistItem[]> {
  const load = async () =>
    (
      ok(
        await refFilter(db.from("checklist_items").select("*, chi:profiles!checklist_items_completato_da_agency_id_fkey(nome, cognome)"), ref)
          .eq("tipo", kind)
          .order("ordine")
          .order("created_at"),
      ) as Row[]
    ).map(toItem);
  let items = await load();
  if (!items.length) {
    ok(await db.rpc("checklist_prepare", { p_property: ref.propertyId ?? null, p_deal: ref.dealId ?? null }));
    items = await load();
  }
  return items;
}

export async function setChecklistState(id: ID, state: ChecklistState, note?: string) {
  const cols: Row = { stato: state };
  if (note !== undefined) cols.nota = note.trim() || null;
  const rows = ok(await db.from("checklist_items").update(cols).eq("id", id).select("id")) as Row[];
  if (!rows.length) throw new NotAllowedError();
  emitChange();
}

export async function linkChecklistDocument(id: ID, documentId: ID | null) {
  const rows = ok(await db.from("checklist_items").update({ document_id: documentId, ...(documentId ? { stato: "fatto" } : {}) }).eq("id", id).select("id")) as Row[];
  if (!rows.length) throw new NotAllowedError();
  emitChange();
}

export async function addChecklistItem(ref: { propertyId?: ID; dealId?: ID }, kind: ChecklistKind, label: string) {
  ok(
    await db.from("checklist_items").insert({
      property_id: ref.propertyId ?? null,
      deal_id: ref.dealId ?? null,
      tipo: kind,
      voce: label.trim(),
      ordine: 100,
    }),
  );
  emitChange();
}

export async function deleteChecklistItem(id: ID) {
  ok(await db.from("checklist_items").delete().eq("id", id));
  emitChange();
}

/** Documenti mancanti (voci obbligatorie da fare sugli immobili attivi) e in scadenza nei prossimi 30 giorni */
export async function paperworkSummary(): Promise<PaperworkSummary> {
  const in30 = new Date(Date.now() + 30 * 86_400_000).toLocaleDateString("sv-SE");
  const [items, docs] = await Promise.all([
    db
      .from("checklist_items")
      .select("property_id, property:properties!inner(indirizzo, stato)")
      .eq("tipo", "documenti")
      .eq("stato", "da_fare")
      .eq("obbligatoria", true)
      .in("property.stato", ["disponibile", "in_trattativa", "sospeso"]),
    db.from("documents").select("id, nome, scadenza, property_id, contact_id").not("scadenza", "is", null).lte("scadenza", in30).order("scadenza"),
  ]);
  const byProp = new Map<string, { propertyId: ID; address: string; count: number }>();
  for (const r of ok(items) as Row[]) {
    const e = byProp.get(r.property_id) ?? { propertyId: r.property_id, address: r.property?.indirizzo ?? "", count: 0 };
    e.count++;
    byProp.set(r.property_id, e);
  }
  return {
    missing: [...byProp.values()].sort((a, b) => b.count - a.count),
    expiring: (ok(docs) as Row[]).map((d) => ({ id: d.id, name: d.nome, expiresOn: d.scadenza, propertyId: d.property_id, contactId: d.contact_id })),
  };
}

/* ---------- Scheda della visita ---------- */

const toFeedback = (r: Row): VisitFeedback => ({
  id: r.id,
  appointmentId: r.appointment_id,
  contactId: r.contact_id,
  propertyId: r.property_id,
  rating: r.voto,
  liked: r.piaciuto ?? "",
  disliked: r.non_piaciuto ?? "",
  issues: r.criticita ?? "",
  priceOpinion: r.giudizio_prezzo,
  offer: r.offerta == null ? null : Number(r.offerta),
  intent: r.intenzione,
  otherProperties: r.altri_immobili ?? "",
  createdAt: r.created_at,
  contactName: r.contact ? `${r.contact.nome} ${r.contact.cognome}`.trim() : undefined,
});

export async function getVisitFeedback(appointmentId: ID): Promise<VisitFeedback | null> {
  const r = ok(await db.from("visit_feedback").select("*").eq("appointment_id", appointmentId).maybeSingle()) as Row | null;
  return r ? toFeedback(r) : null;
}

export async function listVisitFeedback(ref: { propertyId?: ID; contactId?: ID }): Promise<VisitFeedback[]> {
  const q = refFilter(db.from("visit_feedback").select("*, contact:contacts(nome, cognome)"), ref).order("created_at", { ascending: false });
  return (ok(await q) as Row[]).map(toFeedback);
}

export async function saveVisitFeedback(f: VisitFeedbackInput, id?: ID) {
  const cols = {
    appointment_id: f.appointmentId,
    contact_id: f.contactId,
    property_id: f.propertyId,
    voto: f.rating,
    piaciuto: f.liked.trim() || null,
    non_piaciuto: f.disliked.trim() || null,
    criticita: f.issues.trim() || null,
    giudizio_prezzo: f.priceOpinion,
    offerta: f.offer,
    intenzione: f.intent,
    altri_immobili: f.otherProperties.trim() || null,
  };
  if (id) {
    const rows = ok(await db.from("visit_feedback").update(cols).eq("id", id).select("id")) as Row[];
    if (!rows.length) throw new NotAllowedError();
  } else {
    ok(await db.from("visit_feedback").insert(cols));
  }
  emitChange();
}
