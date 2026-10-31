/** Versione "anteprima" di src/services/records.ts: dati di esempio in memoria. */
import { emitChange } from "@/services/events";
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
import { demoDb } from "./api";

export const DOCS_BUCKET = "documenti";
const wait = <T,>(value: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("sv-SE");

type Stored<T> = T & RecordRef;
const docs: Stored<DocumentItem>[] = [
  { id: "d1", propertyId: "p1", category: "ape", name: "APE Via Roma 48.pdf", path: "", mime: "application/pdf", size: 240_000, expiresOn: day(20), notes: null, uploadedBy: "u_1", createdAt: day(-40) },
  { id: "d2", propertyId: "p1", category: "planimetria", name: "Planimetria catastale.pdf", path: "", mime: "application/pdf", size: 410_000, expiresOn: null, notes: null, uploadedBy: "u_1", createdAt: day(-40) },
];
const urls = new Map<string, string>();
const items: Stored<ChecklistItem>[] = [];
const feedback: VisitFeedback[] = [
  { id: "vf1", appointmentId: "x1", contactId: "c1", propertyId: "p1", rating: 4, liked: "Luminosità e balcone", disliked: "Bagno piccolo", issues: "Rumore dalla strada",
    priceOpinion: "alto", offer: 230000, intent: "ci_pensa", otherProperties: "", createdAt: day(-3), contactName: "Maria Rossi" },
];

const PROPERTY_ITEMS: [string, string | null, boolean][] = [
  ["Documento d'identità e codice fiscale dei proprietari", "Di tutti gli intestatari", true],
  ["Incarico di mediazione firmato", null, true],
  ["Atto di provenienza", "Rogito di acquisto, successione o donazione", true],
  ["Visura catastale aggiornata", null, true],
  ["Planimetria catastale", null, true],
  ["APE – Attestato di prestazione energetica", "Vale 10 anni: segna la scadenza", true],
  ["Conformità urbanistica e catastale", "Relazione del tecnico", false],
  ["Certificato di agibilità", null, false],
  ["Dichiarazioni di conformità degli impianti", null, false],
  ["Spese condominiali e ultime delibere", "Ultimi 2 anni, con eventuali lavori deliberati", false],
];
const AML_ITEMS: [string, string | null, boolean][] = [
  ["Identificazione del cliente", "Documento d'identità valido, in copia", true],
  ["Codice fiscale verificato", null, true],
  ["Titolare effettivo", "Solo se il cliente è una società o un ente", false],
  ["Verifica persona politicamente esposta (PEP)", null, true],
  ["Scopo e natura dell'operazione", null, true],
  ["Origine dei fondi e modalità di pagamento", "Mutuo, risparmi, vendita di altro immobile…", true],
  ["Profilo di rischio assegnato", "Basso, medio o alto, con motivazione nella nota", true],
  ["Conservazione di dati e documenti", "Per 10 anni", true],
  ["Valutazione di eventuale operazione sospetta", "Solo se ci sono anomalie", false],
];

const match = (x: RecordRef, ref: RecordRef) =>
  (!ref.contactId || x.contactId === ref.contactId) &&
  (!ref.propertyId || x.propertyId === ref.propertyId) &&
  (!ref.dealId || x.dealId === ref.dealId) &&
  (!ref.acquisitionId || x.acquisitionId === ref.acquisitionId);

export async function listDocuments(ref: RecordRef) {
  return wait(docs.filter((d) => match(d, ref)));
}

export async function uploadDocument(ref: RecordRef, file: File, meta: { category: DocCategory; name: string; expiresOn: string | null }) {
  const d: Stored<DocumentItem> = {
    ...ref, id: demoDb.newId("d"), category: meta.category, name: meta.name.trim() || file.name, path: demoDb.newId("f"), mime: file.type, size: file.size,
    expiresOn: meta.expiresOn, notes: null, uploadedBy: "u_1", createdAt: new Date().toISOString(),
  };
  urls.set(d.path, URL.createObjectURL(file));
  docs.unshift(d);
  emitChange();
  return wait(d, 500);
}

export async function documentUrl(path: string) {
  return wait(urls.get(path) ?? null, 50);
}

export async function deleteDocument(doc: DocumentItem) {
  const i = docs.findIndex((d) => d.id === doc.id);
  if (i >= 0) docs.splice(i, 1);
  emitChange();
}

export async function getChecklist(ref: { propertyId?: ID; dealId?: ID }, kind: ChecklistKind) {
  let list = items.filter((x) => x.kind === kind && match(x, ref));
  if (!list.length) {
    (kind === "documenti" ? PROPERTY_ITEMS : AML_ITEMS).forEach(([label, help, required], i) =>
      items.push({ ...ref, id: demoDb.newId("ck"), kind, label, help, required, state: "da_fare", documentId: null, dueOn: null, note: null, doneBy: null, doneAt: null, order: i + 1 }),
    );
    // Esempio: due documenti già presenti per Via Roma 48
    if (ref.propertyId === "p1") items.filter((x) => x.propertyId === "p1" && /APE|Planimetria|Incarico/.test(x.label)).forEach((x) => Object.assign(x, { state: "fatto", doneBy: "Giuseppe Lorusso", doneAt: day(-10) }));
    list = items.filter((x) => x.kind === kind && match(x, ref));
  }
  return wait(list.map((x) => ({ ...x })).sort((a, b) => a.order - b.order));
}

export async function setChecklistState(id: ID, state: ChecklistState, note?: string) {
  const x = items.find((i) => i.id === id);
  if (x) Object.assign(x, { state, ...(note !== undefined ? { note: note.trim() || null } : {}), doneBy: state === "da_fare" ? null : "Giuseppe Lorusso", doneAt: state === "da_fare" ? null : new Date().toISOString() });
  emitChange();
  return wait(undefined);
}

export async function linkChecklistDocument(id: ID, documentId: ID | null) {
  const x = items.find((i) => i.id === id);
  if (x) Object.assign(x, { documentId, ...(documentId ? { state: "fatto", doneBy: "Giuseppe Lorusso", doneAt: new Date().toISOString() } : {}) });
  emitChange();
  return wait(undefined);
}

export async function addChecklistItem(ref: { propertyId?: ID; dealId?: ID }, kind: ChecklistKind, label: string) {
  items.push({ ...ref, id: demoDb.newId("ck"), kind, label: label.trim(), help: null, required: false, state: "da_fare", documentId: null, dueOn: null, note: null, doneBy: null, doneAt: null, order: 100 });
  emitChange();
  return wait(undefined);
}

export async function deleteChecklistItem(id: ID) {
  const i = items.findIndex((x) => x.id === id);
  if (i >= 0) items.splice(i, 1);
  emitChange();
  return wait(undefined);
}

export async function paperworkSummary(): Promise<PaperworkSummary> {
  const in30 = day(30);
  // Nell'anteprima la checklist di Via Roma 48 parte con 3 documenti obbligatori mancanti
  const missing = items.length
    ? Object.values(
        items
          .filter((x) => x.kind === "documenti" && x.state === "da_fare" && x.required && x.propertyId)
          .reduce<Record<string, { propertyId: ID; address: string; count: number }>>((acc, x) => {
            acc[x.propertyId!] ??= { propertyId: x.propertyId!, address: x.propertyId === "p1" ? "Via Roma 48" : "Immobile", count: 0 };
            acc[x.propertyId!].count++;
            return acc;
          }, {}),
      )
    : [{ propertyId: "p1", address: "Via Roma 48", count: 3 }];
  return wait({
    missing,
    expiring: docs.filter((d) => d.expiresOn && d.expiresOn <= in30).map((d) => ({ id: d.id, name: d.name, expiresOn: d.expiresOn!, propertyId: d.propertyId ?? null, contactId: d.contactId ?? null })),
  });
}

export async function getVisitFeedback(appointmentId: ID) {
  return wait(feedback.find((f) => f.appointmentId === appointmentId) ?? null);
}

export async function listVisitFeedback(ref: { propertyId?: ID; contactId?: ID }) {
  return wait(feedback.filter((f) => (!ref.propertyId || f.propertyId === ref.propertyId) && (!ref.contactId || f.contactId === ref.contactId)));
}

export async function saveVisitFeedback(f: VisitFeedbackInput, id?: ID) {
  const existing = id ? feedback.find((x) => x.id === id) : undefined;
  if (existing) Object.assign(existing, f);
  else {
    feedback.unshift({ ...f, id: demoDb.newId("vf"), createdAt: new Date().toISOString() });
    if (f.contactId) demoDb.addActivity(f.contactId, `Com'è andata la visita${f.intent === "proposta" ? " · vuole fare una proposta" : ""}`);
  }
  emitChange();
  return wait(undefined);
}
