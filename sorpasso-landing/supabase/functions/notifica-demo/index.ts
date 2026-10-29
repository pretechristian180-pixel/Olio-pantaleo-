/**
 * Notifica email al team per ogni nuova richiesta di demo.
 * Chiamata da un Database Webhook su INSERT in public.demo_requests (vedi README).
 *
 * Secrets: RESEND_API_KEY, NOTIFICA_EMAIL_A (anche più indirizzi separati da virgola),
 *          NOTIFICA_EMAIL_DA (mittente verificato su Resend), WEBHOOK_SEGRETO.
 * Il webhook deve inviare l'header "x-webhook-segreto: <WEBHOOK_SEGRETO>".
 * Pubblicare con --no-verify-jwt (l'autenticazione è il segreto condiviso).
 */

interface Richiesta {
  nome: string;
  concessionaria: string;
  citta: string;
  telefono: string;
  venditori: number;
  lead_mese: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Confronto a tempo costante per il segreto del webhook. */
function uguali(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Metodo non consentito", { status: 405 });

  const segreto = Deno.env.get("WEBHOOK_SEGRETO");
  if (!segreto || !uguali(req.headers.get("x-webhook-segreto") ?? "", segreto)) {
    return new Response("Non autorizzato", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (payload?.type !== "INSERT" || payload?.table !== "demo_requests" || !payload.record) {
    return new Response("Ignorato", { status: 200 });
  }
  const r = payload.record as Richiesta;

  const chiave = Deno.env.get("RESEND_API_KEY");
  const a = Deno.env.get("NOTIFICA_EMAIL_A");
  const da = Deno.env.get("NOTIFICA_EMAIL_DA");
  if (!chiave || !a || !da) {
    console.error("[notifica-demo] configurazione email mancante");
    return new Response("Configurazione mancante", { status: 500 });
  }

  const quando = new Date(r.created_at).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Rome" });
  const tel = r.telefono.replace(/[^\d+]/g, "");
  const righe: [string, string][] = [
    ["Nome", r.nome],
    ["Concessionaria", r.concessionaria],
    ["Città", r.citta],
    ["Telefono", r.telefono],
    ["Venditori", String(r.venditori)],
    ["Lead al mese", r.lead_mese],
    ["Campagna", [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ") || "—"],
    ["Ricevuta", quando],
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0d1526">
  <h2 style="margin:0 0 12px">Nuova richiesta di demo</h2>
  <table cellpadding="6" style="border-collapse:collapse">${righe
    .map(([k, v]) => `<tr><td style="color:#5b6578">${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`)
    .join("")}</table>
  <p style="margin-top:16px"><a href="tel:${esc(tel)}" style="background:#2f6bff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Chiama ora</a></p>
  <p style="color:#5b6578;font-size:13px">Obiettivo: richiamare entro un giorno lavorativo.</p></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: da,
      to: a.split(",").map((x) => x.trim()).filter(Boolean),
      subject: `Demo richiesta: ${r.concessionaria} (${r.citta})`,
      html,
    }),
  });
  if (!res.ok) {
    // Solo lo stato HTTP nei log, mai i dati della richiesta
    console.error("[notifica-demo] invio email non riuscito", res.status);
    return new Response("Invio non riuscito", { status: 502 });
  }
  return new Response("ok", { status: 200 });
});
