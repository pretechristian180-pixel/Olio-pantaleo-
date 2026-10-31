/** Versione "anteprima" di src/services/imports.ts: pulizia e importazione simulate in memoria. */
import { emitChange } from "@/services/events";
import type { Sheet } from "@/lib/spreadsheet";
import { autoMap, fields, type ImportType } from "@/features/import/fields";
import type { Contact } from "@/types/domain";
import type { DiscardedRow, DuplicateOption, ImportJob, ImportPreview, PreviewRow } from "@/types/imports";
import { demoDb } from "./api";

const wait = <T,>(value: T, ms = 300) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

type Riga = { number: number; original: Record<string, string>; esito?: "ok" | "duplicato" | "errore"; msg?: string; recordId?: string };
const rowsByJob = new Map<string, Riga[]>();

const jobs: ImportJob[] = [
  {
    id: "imp_1", type: "contatti", fileName: "rubrica-vecchio-gestionale.xlsx", state: "completato", total: 412, imported: 371, updated: 0, skipped: 29, discarded: 12,
    mapping: {}, duplicates: "salta", createdAt: ago(24 * 9), completedAt: ago(24 * 9),
  },
];
rowsByJob.set("imp_1", [
  { number: 14, original: { Nominativo: "Studio Ferri", Cellulare: "", Mail: "" }, esito: "errore", msg: "Né telefono né email" },
  { number: 37, original: { Nominativo: "", Cellulare: "333 1112223", Mail: "" }, esito: "errore", msg: "Manca il nome" },
  { number: 52, original: { Nominativo: "Maria Rossi", Cellulare: "+39 333 1234567", Mail: "" }, esito: "duplicato", msg: "Già presente" },
]);

/* ---------- Pulizia (come le funzioni imp_* del database) ---------- */
const txt = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim();
const nome = (s?: string) => txt(s).toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
function telefono(s?: string) {
  let d = txt(s).replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = `+${d.slice(2)}`;
  if (!d.startsWith("+")) d = `+39${d}`;
  return d.startsWith("+39") ? `+39 ${d.slice(3)}` : d;
}
const email = (s?: string) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(txt(s).toLowerCase()) ? txt(s).toLowerCase() : "");
function numero(s?: string) {
  const t = txt(s).replace(/[€\s]|mq|m2/gi, "");
  if (!t) return null;
  const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/[.,]/g, ""));
  return Number.isFinite(n) ? n : null;
}
const key = (tel: string, mail: string) => tel.replace(/\D/g, "").replace(/^39/, "") || mail;

function normalize(type: ImportType, map: Record<string, string>, row: Record<string, string>) {
  const v: Record<string, string> = {};
  const note: string[] = [];
  for (const [col, val] of Object.entries(row)) {
    if (!txt(val)) continue;
    const f = map[col];
    if (!f) note.push(`${col}: ${txt(val)}`);
    else v[f] = v[f] ? `${v[f]} ${txt(val)}` : txt(val);
  }
  if (v.note) note.unshift(v.note);
  const d: Record<string, unknown> = {};
  const warnings: string[] = [];
  let error: string | null = null;
  let k = "";
  if (type === "contatti") {
    if (v.nome_completo && !v.nome) [v.nome, v.cognome] = [v.nome_completo.split(" ")[0], v.nome_completo.split(" ").slice(1).join(" ")];
    if (v.cognome_nome && !v.nome) [v.cognome, v.nome] = [v.cognome_nome.split(" ")[0], v.cognome_nome.split(" ").slice(1).join(" ")];
    const tel = telefono(v.telefono);
    const mail = email(v.email);
    if (v.email && !mail) warnings.push(`Email non valida: ${v.email}`);
    if (!v.nome && !v.cognome) error = "Manca il nome";
    else if (!tel && !mail) warnings.push("Né telefono né email");
    Object.assign(d, { nome: nome(v.nome || v.cognome), cognome: v.nome ? nome(v.cognome) : "", telefono: tel || undefined, email: mail || undefined, tipo: v.tipo ? txt(v.tipo).toLowerCase() : "acquirente" });
    k = key(tel, mail);
  } else {
    for (const f of fields[type]) if (v[f.key] && f.key !== "note") d[f.key] = /prezzo|budget|mq|locali|bagni/.test(f.key) ? (numero(v[f.key]) ?? v[f.key]) : v[f.key];
    const req = fields[type].find((f) => f.required && !v[f.key]);
    if (req) error = `Manca: ${req.label.toLowerCase()}`;
    if (type === "immobili" && v.prezzo && numero(v.prezzo) == null) error = "Prezzo non leggibile";
    if (type === "richieste" && !v.contatto_telefono && !v.contatto_email && !v.contatto_nome) error = "Cliente non trovato: importa prima i contatti";
    k = JSON.stringify(d);
  }
  return { d, note: note.join("\n") || null, error, key: k, warnings };
}

function exists(type: ImportType, k: string) {
  return type === "contatti" && !!k && demoDb.contacts().some((c) => key(telefono(c.phone), (c.email ?? "").toLowerCase()) === k);
}

/* ---------- Le stesse funzioni del servizio vero ---------- */
export async function listJobs() {
  return wait(jobs.map((j) => ({ ...j })));
}
export async function getJob(id: string) {
  return wait({ ...jobs.find((j) => j.id === id)! }, 150);
}
export async function countContacts() {
  return wait(demoDb.contacts().length, 100);
}
export async function createJob(type: ImportType, file: File, sheet: Sheet, onProgress?: (pct: number) => void): Promise<ImportJob> {
  const job: ImportJob = {
    id: `imp_${Date.now()}`, type, fileName: file.name, state: "caricato", total: sheet.rows.length, imported: 0, updated: 0, skipped: 0, discarded: 0,
    mapping: {}, duplicates: "salta", createdAt: new Date().toISOString(), completedAt: null,
  };
  rowsByJob.set(job.id, sheet.rows.map((cells, i) => ({ number: i + 2, original: Object.fromEntries(sheet.headers.map((h, c) => [h, cells[c] ?? ""])) })));
  jobs.unshift(job);
  onProgress?.(100);
  return wait({ ...job }, 500);
}
export async function suggestMapping(type: ImportType, sheet: Sheet) {
  return wait({ mapping: autoMap(type, sheet.headers), ai: false }, 700);
}
export async function preview(jobId: string, mapping: Record<string, string>, duplicates: DuplicateOption): Promise<ImportPreview> {
  const job = jobs.find((j) => j.id === jobId)!;
  Object.assign(job, { mapping, duplicates, state: "anteprima" });
  const seen = new Set<string>();
  const out: ImportPreview = { total: 0, valid: 0, duplicates: 0, errors: 0, rows: [] };
  for (const r of rowsByJob.get(jobId) ?? []) {
    const x = normalize(job.type, mapping, r.original);
    const dup = !x.error && ((!!x.key && seen.has(x.key)) || exists(job.type, x.key));
    if (x.key) seen.add(x.key);
    out.total++;
    if (x.error) out.errors++;
    else if (dup) out.duplicates++;
    else out.valid++;
    if (out.rows.length < 20) out.rows.push({ number: r.number, data: x.d, note: x.note, error: x.error, duplicate: dup, warnings: x.warnings } satisfies PreviewRow);
  }
  return wait(out, 600);
}
export async function start(jobId: string, mapping: Record<string, string>, duplicates: DuplicateOption) {
  Object.assign(jobs.find((j) => j.id === jobId)!, { mapping, duplicates, state: "in_corso" });
  emitChange();
}
export async function processStep(jobId: string) {
  const job = jobs.find((j) => j.id === jobId)!;
  const rows = rowsByJob.get(jobId) ?? [];
  const seen = new Set(rows.filter((r) => r.esito).map((r) => normalize(job.type, job.mapping, r.original).key));
  const todo = rows.filter((r) => !r.esito).slice(0, Math.max(5, Math.ceil(rows.length / 8)));
  for (const r of todo) {
    const x = normalize(job.type, job.mapping, r.original);
    const dup = (!!x.key && seen.has(x.key)) || exists(job.type, x.key);
    if (x.key) seen.add(x.key);
    if (x.error) Object.assign(r, { esito: "errore", msg: x.error });
    else if (dup && job.duplicates === "salta") Object.assign(r, { esito: "duplicato", msg: "Già presente" });
    else if (dup && job.duplicates === "aggiorna") Object.assign(r, { esito: "ok", msg: "aggiornato" });
    else {
      r.esito = "ok";
      if (job.type === "contatti") {
        const d = x.d as Record<string, string>;
        const c: Contact = {
          id: demoDb.newId("c_imp"), agencyId: demoDb.agencyId, agentId: demoDb.me, firstName: d.nome, lastName: d.cognome ?? "", phone: d.telefono ?? "", email: d.email,
          role: (["acquirente", "proprietario", "inquilino", "locatore"].includes(d.tipo) ? d.tipo : "acquirente") as Contact["role"], temperature: "tiepido", source: "altro",
          notes: x.note ?? undefined, tags: [], createdAt: new Date().toISOString(),
        };
        demoDb.addContact(c);
        r.recordId = c.id;
      }
    }
  }
  const left = rows.filter((r) => !r.esito).length;
  Object.assign(job, {
    imported: rows.filter((r) => r.esito === "ok" && r.msg !== "aggiornato").length,
    updated: rows.filter((r) => r.msg === "aggiornato").length,
    skipped: rows.filter((r) => r.esito === "duplicato").length,
    discarded: rows.filter((r) => r.esito === "errore").length,
    ...(left === 0 ? { state: "completato", completedAt: new Date().toISOString() } : {}),
  });
  if (left === 0) emitChange();
  return wait(left, 700);
}
export async function discardedRows(jobId: string): Promise<DiscardedRow[]> {
  return wait(
    (rowsByJob.get(jobId) ?? []).filter((r) => r.esito === "errore" || r.esito === "duplicato").map((r) => ({ number: r.number, original: r.original, reason: r.msg ?? "" })),
  );
}
export async function undo(jobId: string) {
  const job = jobs.find((j) => j.id === jobId)!;
  if (!job.completedAt || Date.now() - new Date(job.completedAt).getTime() > 24 * 3600_000)
    throw new Error("Sono passate più di 24 ore: l'importazione non si può più annullare");
  const ids = (rowsByJob.get(jobId) ?? []).map((r) => r.recordId).filter((x): x is string => !!x);
  demoDb.removeContacts(ids);
  job.state = "annullato";
  emitChange();
  return wait(job.imported);
}
