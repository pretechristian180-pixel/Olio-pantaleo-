/** Testi delle email transazionali: HTML semplice e versione testo. Logica pura, testata. */

export type EmailContent = { subject: string; html: string; text: string };

type Brand = { nome: string; colore: string };

export function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Impaginazione comune: leggibile in ogni client di posta, niente immagini esterne. */
function layout(brand: Brand, body: string, cta?: { label: string; url: string }) {
  const color = HEX.test(brand.colore) ? brand.colore : "#0042ed";
  const button = cta
    ? `<p style="margin:28px 0"><a href="${escapeHtml(cta.url)}" style="background:${color};color:#ffffff;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:6px;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1d2124">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px">
<tr><td style="padding:28px 32px;border-bottom:4px solid ${color};font-weight:700;letter-spacing:.04em">${escapeHtml(brand.nome.toUpperCase())}</td></tr>
<tr><td style="padding:28px 32px;font-size:16px;line-height:1.55">${body}${button}</td></tr>
</table>
<p style="font-size:12px;color:#6b7280;margin:16px 0 0">Email inviata da ${escapeHtml(brand.nome)}.</p>
</td></tr></table></body></html>`;
}

export function purchaseConfirmation(o: {
  brand: Brand;
  nome: string | null;
  corso: string;
  importo: string;
  url: string;
}): EmailContent {
  const saluto = o.nome ? `Ciao ${o.nome},` : "Ciao,";
  return {
    subject: `Il corso «${o.corso}» è tuo`,
    html: layout(
      o.brand,
      `<p>${escapeHtml(saluto)}</p>
<p>grazie per l'acquisto. Il corso <strong>${escapeHtml(o.corso)}</strong> è già attivo nella tua area: puoi iniziare subito, anche da telefono.</p>
<p style="color:#6b7280;font-size:14px">Importo pagato: ${escapeHtml(o.importo)}. La ricevuta del pagamento ti arriva in una email separata da Stripe.</p>`,
      { label: "Inizia il corso", url: o.url },
    ),
    text: `${saluto}\n\ngrazie per l'acquisto. Il corso «${o.corso}» è già attivo nella tua area.\nInizia da qui: ${o.url}\n\nImporto pagato: ${o.importo}. La ricevuta ti arriva da Stripe.\n\n${o.brand.nome}`,
  };
}

export function saleNotification(o: {
  brand: Brand;
  corso: string;
  importo: string;
  studente: string;
  url: string;
}): EmailContent {
  return {
    subject: `Nuova vendita: ${o.corso} (${o.importo})`,
    html: layout(
      o.brand,
      `<p>Hai venduto <strong>${escapeHtml(o.corso)}</strong> a ${escapeHtml(o.studente)} per <strong>${escapeHtml(o.importo)}</strong>.</p>
<p>L'accesso allo studente è già attivo. I soldi arrivano sul tuo conto Stripe.</p>`,
      { label: "Apri il pannello", url: o.url },
    ),
    text: `Hai venduto «${o.corso}» a ${o.studente} per ${o.importo}.\nL'accesso è già attivo. Pannello: ${o.url}`,
  };
}

export function academyWelcome(o: { nomeAcademy: string; url: string }): EmailContent {
  const brand = { nome: "Nexora Academy", colore: "#0042ed" };
  return {
    subject: `La tua academy «${o.nomeAcademy}» è pronta`,
    html: layout(
      brand,
      `<p>Benvenuto in Nexora Academy!</p>
<p>La tua academy <strong>${escapeHtml(o.nomeAcademy)}</strong> è online. Da qui parti con i tre passi che contano:</p>
<ol style="padding-left:20px">
<li>Imposta logo e colori in <em>Impostazioni</em>.</li>
<li>Crea il primo corso e carica i video.</li>
<li>Collega Stripe per incassare: i soldi arrivano a te, senza commissioni Nexora.</li>
</ol>`,
      { label: "Apri il pannello", url: o.url },
    ),
    text: `Benvenuto in Nexora Academy!\n\nLa tua academy «${o.nomeAcademy}» è online.\n1. Imposta logo e colori in Impostazioni.\n2. Crea il primo corso e carica i video.\n3. Collega Stripe per incassare, senza commissioni Nexora.\n\nPannello: ${o.url}`,
  };
}

export function answerNotification(o: {
  brand: Brand;
  lezione: string;
  risposta: string;
  url: string;
}): EmailContent {
  const estratto = o.risposta.length > 600 ? `${o.risposta.slice(0, 600)}…` : o.risposta;
  return {
    subject: `Hai una risposta sulla lezione «${o.lezione}»`,
    html: layout(
      o.brand,
      `<p>Il docente ha risposto alla tua domanda sulla lezione <strong>${escapeHtml(o.lezione)}</strong>:</p>
<blockquote style="margin:16px 0;padding:12px 16px;background:#f4f5f7;border-radius:6px;white-space:pre-line">${escapeHtml(estratto)}</blockquote>`,
      { label: "Apri la lezione", url: o.url },
    ),
    text: `Il docente ha risposto alla tua domanda sulla lezione «${o.lezione}»:\n\n${estratto}\n\nApri la lezione: ${o.url}`,
  };
}
