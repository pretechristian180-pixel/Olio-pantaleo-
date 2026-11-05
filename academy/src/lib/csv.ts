/** CSV per Excel italiano: separatore ";", BOM UTF-8, campi tra virgolette quando serve. */
export function toCsv(rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    // Evita che Excel interpreti il contenuto come formula.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}
