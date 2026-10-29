/** Mascheramento dei dati personali per log e avvisi: mai valori completi. */

/** "12345678903" → "1234*****03" */
export function mascheraCodice(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (s.length <= 6) return "*".repeat(s.length);
  return s.slice(0, 4) + "*".repeat(s.length - 6) + s.slice(-2);
}

/** "mario.rossi@azienda.it" → "m***@azienda.it" */
export function mascheraEmail(v: string | null | undefined): string | null {
  if (!v || !v.includes("@")) return v ? "***" : null;
  const [u, d] = v.split("@");
  return `${u!.slice(0, 1)}***@${d}`;
}

/** "Rossi Mario Srl" → "Ros… (15)" */
export function mascheraNome(v: string | null | undefined): string | null {
  if (!v) return null;
  return `${v.trim().slice(0, 3)}… (${v.trim().length})`;
}

const CHIAVI_CODICE = /partita_iva|vat_number|codice_fiscale|tax_code|codice_destinatario|ei_code|iban/i;
const CHIAVI_EMAIL = /email|pec|certified_email/i;
const CHIAVI_NOME = /ragione_sociale|name|nome|via|address/i;

/** Maschera in profondità un oggetto prima di scriverlo nei log. */
export function mascheraOggetto(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(mascheraOggetto);
  if (x && typeof x === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (typeof v === "string" && CHIAVI_EMAIL.test(k)) out[k] = mascheraEmail(v);
      else if (typeof v === "string" && CHIAVI_CODICE.test(k)) out[k] = mascheraCodice(v);
      else if (typeof v === "string" && CHIAVI_NOME.test(k)) out[k] = mascheraNome(v);
      else out[k] = mascheraOggetto(v);
    }
    return out;
  }
  return x;
}
