/**
 * Lettura di file Excel (.xlsx) e CSV nel browser. Restituisce intestazioni e righe come testo.
 * Le date delle celle Excel diventano AAAA-MM-GG (con l'ora se c'è).
 */
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";

export const MAX_ROWS = 10_000;

export interface Sheet {
  headers: string[];
  rows: string[][];
}

function cell(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    const d = `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    return v.getHours() || v.getMinutes() ? `${d} ${p(v.getHours())}:${p(v.getMinutes())}` : d;
  }
  return String(v).trim();
}

/** Intestazioni uniche e mai vuote */
function cleanHeaders(raw: unknown[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = cell(h) || `Colonna ${i + 1}`;
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    if (n) name = `${name} (${n + 1})`;
    return name;
  });
}

export async function readSpreadsheet(file: File): Promise<Sheet> {
  const name = file.name.toLowerCase();
  let data: unknown[][];
  if (name.endsWith(".xlsx")) {
    data = (await readSheet(file)) as unknown[][];
  } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy", delimiter: "" });
    data = parsed.data;
  } else if (name.endsWith(".xls")) {
    throw new Error("Il formato .xls (Excel vecchio) non si può leggere: aprilo in Excel e salvalo come .xlsx o .csv.");
  } else {
    throw new Error("Scegli un file Excel (.xlsx) o CSV.");
  }
  // La prima riga non vuota contiene le intestazioni
  const start = data.findIndex((r) => r.some((c) => cell(c) !== ""));
  if (start < 0) throw new Error("Il file è vuoto.");
  const headers = cleanHeaders(data[start]);
  const rows = data
    .slice(start + 1)
    .map((r) => headers.map((_, i) => cell(r[i])))
    .filter((r) => r.some((c) => c !== ""));
  if (!rows.length) throw new Error("Il file ha solo le intestazioni, nessuna riga da importare.");
  if (rows.length > MAX_ROWS) throw new Error(`Il file ha ${rows.length.toLocaleString("it-IT")} righe: il massimo è ${MAX_ROWS.toLocaleString("it-IT")}. Dividilo in più file.`);
  return { headers, rows };
}
