/**
 * Livello dati dell'Importazione guidata. Solo il titolare (policy RLS).
 * Il file va nel bucket privato "imports" nella cartella dell'agenzia (eliminato dopo 30 giorni);
 * le righe vanno in import_rows e le pulisce e importa il database (import_process, anche da pg_cron).
 * L'abbinamento delle colonne con l'AI passa dalla Edge Function "importazione": la chiave resta lì.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Sheet } from "@/lib/spreadsheet";
import { autoMap, type ImportType } from "@/features/import/fields";
import type { DiscardedRow, DuplicateOption, ImportJob, ImportPreview } from "@/types/imports";
import { emitChange } from "./events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function ok<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

const toJob = (r: Row): ImportJob => ({
  id: r.id,
  type: r.tipo,
  fileName: r.nome_file,
  state: r.stato,
  total: r.righe_totali,
  imported: r.righe_importate,
  updated: r.righe_aggiornate,
  skipped: r.righe_saltate,
  discarded: r.righe_scartate,
  mapping: Object.fromEntries(Object.entries((r.mappatura_colonne ?? {}) as Record<string, string | null>).map(([k, v]) => [k, v ?? ""])),
  duplicates: r.opzione_duplicati,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

export async function listJobs(): Promise<ImportJob[]> {
  return (ok(await db.from("import_jobs").select("*").order("created_at", { ascending: false }).limit(30)) as Row[]).map(toJob);
}

export async function getJob(id: string): Promise<ImportJob> {
  return toJob(ok(await db.from("import_jobs").select("*").eq("id", id).single()));
}

/** Quanti contatti ha già l'agenzia (per avvisare se si importano richieste prima dei contatti) */
export async function countContacts(): Promise<number> {
  const res = await db.from("contacts").select("id", { count: "exact", head: true });
  if (res.error) throw res.error;
  return res.count ?? 0;
}

/** Carica il file e le righe lette nel browser. Restituisce il lavoro creato. */
export async function createJob(type: ImportType, file: File, sheet: Sheet, onProgress?: (pct: number) => void): Promise<ImportJob> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id ?? "";
  const prof = ok(await db.from("profiles").select("agency_id").eq("id", uid).single()) as Row;
  const job = ok(await db.from("import_jobs").insert({ tipo: type, nome_file: file.name.slice(0, 200) }).select("*").single()) as Row;

  const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-120) || "file";
  const path = `${prof.agency_id}/${job.id}/${safe}`;
  const up = await supabase.storage.from("imports").upload(path, file, { contentType: file.type || undefined });
  if (!up.error) await db.from("import_jobs").update({ file_url: path }).eq("id", job.id);

  const BATCH = 500;
  for (let i = 0; i < sheet.rows.length; i += BATCH) {
    const chunk = sheet.rows.slice(i, i + BATCH).map((cells, k) => ({
      import_job_id: job.id,
      numero_riga: i + k + 2, // la riga 1 del file è quella delle intestazioni
      dati_originali: Object.fromEntries(sheet.headers.map((h, c) => [h, cells[c] ?? ""])),
    }));
    ok(await db.from("import_rows").insert(chunk));
    onProgress?.(Math.min(100, Math.round(((i + chunk.length) / sheet.rows.length) * 100)));
  }
  return toJob(job);
}

/** Abbinamento proposto dall'AI; se l'AI non è configurata o non risponde, quello automatico */
export async function suggestMapping(type: ImportType, sheet: Sheet): Promise<{ mapping: Record<string, string>; ai: boolean }> {
  const base = autoMap(type, sheet.headers);
  try {
    const esempi = sheet.headers.map((_, c) => sheet.rows.map((r) => r[c] ?? "").filter(Boolean).slice(0, 3));
    const { data, error } = await supabase.functions.invoke("importazione", { body: { azione: "mappa", tipo: type, intestazioni: sheet.headers, esempi } });
    if (error || !data?.mappatura) return { mapping: base, ai: false };
    const m = data.mappatura as Record<string, string | null>;
    return { mapping: Object.fromEntries(sheet.headers.map((h) => [h, h in m ? (m[h] ?? "") : base[h]])), ai: true };
  } catch {
    return { mapping: base, ai: false };
  }
}

const toDb = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v || null]));

/** Salva abbinamento e scelta sui doppioni, poi calcola l'anteprima (prime 20 righe e conteggi) */
export async function preview(jobId: string, mapping: Record<string, string>, duplicates: DuplicateOption): Promise<ImportPreview> {
  ok(await db.from("import_jobs").update({ mappatura_colonne: toDb(mapping), opzione_duplicati: duplicates }).eq("id", jobId).select("id"));
  const p = ok(await db.rpc("import_preview", { p_job: jobId })) as Row;
  return {
    total: p.totale,
    valid: p.valide,
    duplicates: p.duplicati,
    errors: p.errori,
    rows: ((p.righe ?? []) as Row[]).map((r) => ({
      number: r.numero,
      data: r.d ?? {},
      note: r.note ?? null,
      error: r.errore ?? null,
      duplicate: !!r.duplicato,
      warnings: r.avvisi ?? [],
    })),
  };
}

export async function start(jobId: string, mapping: Record<string, string>, duplicates: DuplicateOption) {
  ok(await db.rpc("import_start", { p_job: jobId, p_mappatura: toDb(mapping), p_duplicati: duplicates }));
  emitChange();
}

/** Importa un blocco di righe; restituisce quante ne mancano. Se la pagina si chiude, continua pg_cron. */
export async function processStep(jobId: string): Promise<number> {
  return Number(ok(await db.rpc("import_process", { p_job: jobId, p_limite: 500 })));
}

export async function discardedRows(jobId: string): Promise<DiscardedRow[]> {
  const out: DiscardedRow[] = [];
  for (let from = 0; ; from += 1000) {
    const page = ok(
      await db
        .from("import_rows")
        .select("numero_riga, dati_originali, esito, messaggio")
        .eq("import_job_id", jobId)
        .in("esito", ["errore", "duplicato"])
        .order("numero_riga")
        .range(from, from + 999),
    ) as Row[];
    out.push(
      ...page.map((r) => ({
        number: r.numero_riga,
        original: r.dati_originali ?? {},
        reason: r.messaggio ?? (r.esito === "duplicato" ? "Già presente" : "Dati non validi"),
      })),
    );
    if (page.length < 1000) return out;
  }
}

export async function undo(jobId: string): Promise<number> {
  const n = Number(ok(await db.rpc("import_undo", { p_job: jobId })));
  emitChange();
  return n;
}
