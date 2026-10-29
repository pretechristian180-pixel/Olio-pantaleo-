/**
 * CSV per il commercialista, pronto per Excel in italiano:
 * separatore ";", decimali con la virgola, BOM UTF-8 (accenti corretti all'apertura).
 */
export type Cella = string | number | null | undefined;

/** Interi senza decimali (giorni, aliquote), importi con due decimali e la virgola. */
const numeroCsv = (n: number) => (Number.isInteger(n) ? String(n) : (Math.round(n * 100) / 100).toFixed(2).replace(".", ","));

function cella(v: Cella): string {
  if (v == null) return "";
  const s = typeof v === "number" ? numeroCsv(v) : v;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function creaCsv(intestazioni: string[], righe: Cella[][]): string {
  return [intestazioni, ...righe].map((r) => r.map(cella).join(";")).join("\r\n");
}

export function scaricaCsv(nomeFile: string, contenuto: string) {
  const blob = new Blob(["﻿" + contenuto], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Data ISO (YYYY-MM-DD) → gg/mm/aaaa */
export const dataCsv = (d: string | null | undefined) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");
