/**
 * Email transazionali con Resend (https://resend.com): avvisi all'amministratore, riepilogo settimanale,
 * copia di cortesia al cliente con il PDF. Chiave in RESEND_API_KEY; senza chiave le email non partono
 * (l'avviso resta comunque nel pannello).
 */

export interface Allegato {
  filename: string;
  /** contenuto in base64 */
  content: string;
}

export interface Email {
  a: string[];
  oggetto: string;
  html: string;
  allegati?: Allegato[];
}

export class Postino {
  constructor(private chiave: string | null, private mittente: string | null, private fetchFn: typeof fetch = fetch) {}

  get attivo() {
    return !!this.chiave && !!this.mittente;
  }

  async invia(e: Email): Promise<boolean> {
    if (!this.attivo || !e.a.length) return false;
    const res = await this.fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.chiave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.mittente,
        to: e.a,
        subject: e.oggetto,
        html: e.html,
        ...(e.allegati?.length ? { attachments: e.allegati } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    return !!res?.ok;
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Impaginazione semplice e leggibile anche dai client di posta più vecchi. */
export function impagina(titolo: string, corpo: string, pulsante?: { testo: string; url: string }): string {
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#0d1526">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e9f0">
<tr><td style="background:#0b1530;color:#ffffff;padding:18px 24px;border-radius:12px 12px 0 0;font-size:18px;font-weight:bold">${escapeHtml(titolo)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">${corpo}
${pulsante ? `<p style="margin-top:24px"><a href="${escapeHtml(pulsante.url)}" style="background:#3d6bff;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">${escapeHtml(pulsante.testo)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

export const euroIt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

export function base64DaBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
