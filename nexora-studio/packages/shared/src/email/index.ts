/**
 * Email transazionali tramite adapter (prima implementazione: Resend via API REST).
 * Senza RESEND_API_KEY l'email non parte: il chiamante decide l'alternativa.
 */
export interface EmailMessage {
  to: string | string[];
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
      // Nel log solo lo stato: mai destinatari, contenuto o chiave.
      console.error(JSON.stringify({ msg: "email non inviata", provider: this.name, status: res.status }));
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

/** Solo sviluppo: consegna a Mailpit (la casella di prova di Supabase locale). */
class MailpitProvider implements EmailProvider {
  readonly name = "mailpit";
  constructor(private url: string) {}

  async send(message: EmailMessage) {
    const to = (Array.isArray(message.to) ? message.to : [message.to]).map((Email) => ({ Email }));
    const res = await fetch(`${this.url}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: "studio@christianprete.it", Name: "Christian Prete Studio" },
        To: to,
        Subject: message.subject,
        HTML: message.html,
        Text: message.text,
      }),
    });
    return { sent: res.ok };
  }
}

export function getEmailProvider(env: Record<string, string | undefined> = process.env): EmailProvider {
  if (env.EMAIL_PROVIDER === "mailpit" && (env.NODE_ENV !== "production" || env.ALLOW_DEMO_PROVIDERS === "true")) {
    return new MailpitProvider(env.MAILPIT_URL ?? "http://127.0.0.1:54324");
  }
  const key = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM ?? "Christian Prete Studio <studio@christianprete.it>";
  return key ? new ResendProvider(key, from) : new DisabledProvider();
}

export function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Layout email coerente col brand: sfondo scuro, pulsante blu. Include la versione solo testo. */
export function brandedEmail({
  title,
  intro,
  ctaLabel,
  ctaUrl,
  outro,
  extraHtml,
  extraText,
}: {
  title: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  outro?: string;
  extraHtml?: string;
  extraText?: string;
}) {
  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#05070d;font-family:Inter,Segoe UI,Arial,sans-serif;color:#eef0f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0a0e17;border:1px solid #1f2638;border-radius:16px;padding:32px">
<tr><td style="font-size:13px;letter-spacing:6px;color:#c9cbd1;padding-bottom:24px">NE<span style="color:#0a5cff">X</span>ORA STUDIO</td></tr>
<tr><td style="font-size:22px;font-weight:700;line-height:1.3;padding-bottom:12px;color:#ffffff">${escapeHtml(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#c4c9d4;padding-bottom:24px">${escapeHtml(intro)}</td></tr>
${extraHtml ? `<tr><td style="padding-bottom:24px">${extraHtml}</td></tr>` : ""}
<tr><td style="padding-bottom:24px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0a5cff;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 22px;border-radius:10px">${escapeHtml(ctaLabel)}</a></td></tr>
${outro ? `<tr><td style="font-size:13px;line-height:1.6;color:#9aa1b2">${escapeHtml(outro)}</td></tr>` : ""}
</table>
<p style="font-size:12px;color:#6b7280;margin-top:16px">Christian Prete Agency</p>
</td></tr></table></body></html>`;
  const text = [title, intro, extraText, `${ctaLabel}: ${ctaUrl}`, outro, "Christian Prete Agency"]
    .filter(Boolean)
    .join("\n\n");
  return { html, text };
}

const FORMAT_LABELS: Record<string, string> = {
  talking_head: "Parli in camera",
  tutorial: "Tutorial",
  behind_the_scenes: "Dietro le quinte",
  product: "Prodotto",
  testimonial: "Storia vera",
};

export function formatLabel(format: string) {
  return FORMAT_LABELS[format] ?? format;
}

/** Email del lunedì: "I tuoi video della settimana". */
export function weeklyScriptsEmail(args: {
  firstName: string | null;
  companyName: string;
  appUrl: string;
  scripts: { id: string; title: string; hook: string; format: string }[];
}) {
  const items = args.scripts
    .map(
      (s, i) => `<tr><td style="padding:12px 14px;border:1px solid #1f2638;border-radius:12px;background:#0f1420">
<div style="font-size:12px;color:#6ea4ff;font-weight:600;padding-bottom:4px">VIDEO ${i + 1} · ${escapeHtml(formatLabel(s.format).toUpperCase())}</div>
<div style="font-size:15px;font-weight:600;color:#ffffff;padding-bottom:4px">${escapeHtml(s.title)}</div>
<div style="font-size:14px;color:#c4c9d4">«${escapeHtml(s.hook)}»</div></td></tr><tr><td style="height:8px"></td></tr>`,
    )
    .join("");
  const extraHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>`;
  const extraText = args.scripts
    .map((s, i) => `${i + 1}. ${s.title} (${formatLabel(s.format)})\n   «${s.hook}»`)
    .join("\n");
  const n = args.scripts.length;
  return {
    subject: `I tuoi ${n} video della settimana sono pronti`,
    ...brandedEmail({
      title: `${args.firstName ? `${args.firstName}, ecco` : "Ecco"} i video della settimana`,
      intro: `Abbiamo preparato ${n} script per ${args.companyName}. Per ognuno trovi la frase d'apertura, il testo e i consigli su dove e come girare.`,
      extraHtml,
      extraText,
      ctaLabel: "Apri gli script",
      ctaUrl: `${args.appUrl}/script`,
      outro: "Gira quando hai un momento e carica il video dall'app: al montaggio pensiamo noi.",
    }),
  };
}
