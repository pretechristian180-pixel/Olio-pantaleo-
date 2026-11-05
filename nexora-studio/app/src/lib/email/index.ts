import "server-only";

/**
 * Invio email transazionali tramite adapter (prima implementazione: Resend via API REST).
 * Senza RESEND_API_KEY l'email non parte e il chiamante mostra un'alternativa (es. link da copiare).
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ sent: boolean; id?: string }>;
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(message: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, ...message }),
    });
    if (!res.ok) {
      // Mai nel log il contenuto dell'email o la chiave: solo lo stato.
      console.error(
        JSON.stringify({ msg: "email non inviata", provider: this.name, status: res.status }),
      );
      return { sent: false };
    }
    const data = (await res.json()) as { id?: string };
    return { sent: true, id: data.id };
  }
}

class DisabledProvider implements EmailProvider {
  readonly name = "disabled";
  async send() {
    return { sent: false };
  }
}

export function getEmailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Nexora Studio <studio@nexoragruppodigitale.it>";
  return key ? new ResendProvider(key, from) : new DisabledProvider();
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Layout email coerente col brand: sfondo scuro, pulsante blu. Testo semplice incluso. */
export function brandedEmail({
  title,
  intro,
  ctaLabel,
  ctaUrl,
  outro,
}: {
  title: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  outro?: string;
}) {
  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#05070d;font-family:Inter,Segoe UI,Arial,sans-serif;color:#eef0f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0a0e17;border:1px solid #1f2638;border-radius:16px;padding:32px">
<tr><td style="font-size:13px;letter-spacing:6px;color:#c9cbd1;padding-bottom:24px">NE<span style="color:#0a5cff">X</span>ORA STUDIO</td></tr>
<tr><td style="font-size:22px;font-weight:700;line-height:1.3;padding-bottom:12px;color:#ffffff">${escapeHtml(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#c4c9d4;padding-bottom:24px">${escapeHtml(intro)}</td></tr>
<tr><td style="padding-bottom:24px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0a5cff;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 22px;border-radius:10px">${escapeHtml(ctaLabel)}</a></td></tr>
${outro ? `<tr><td style="font-size:13px;line-height:1.6;color:#9aa1b2">${escapeHtml(outro)}</td></tr>` : ""}
</table>
<p style="font-size:12px;color:#6b7280;margin-top:16px">Nexora Gruppo Digitale</p>
</td></tr></table></body></html>`;
  const text = `${title}\n\n${intro}\n\n${ctaLabel}: ${ctaUrl}\n\n${outro ?? ""}\n\nNexora Gruppo Digitale`;
  return { html, text };
}
