import "server-only";
import { optionalServerEnv } from "@/lib/env.server";
import type { EmailContent } from "@/lib/email-templates";

/**
 * Invio con Resend. Non blocca mai il flusso principale: se l'invio fallisce lo registriamo e
 * andiamo avanti (un acquisto resta valido anche se l'email non parte).
 */
export async function sendEmail(o: {
  to: string | string[];
  content: EmailContent;
  /** Nome mostrato come mittente, es. il nome dell'academy. */
  fromName?: string;
  replyTo?: string;
  /** Chiave anti-duplicato: lo stesso invio ripetuto non arriva due volte. */
  idempotencyKey?: string;
}) {
  const key = optionalServerEnv("RESEND_API_KEY");
  const from = optionalServerEnv("EMAIL_FROM");
  if (!key || !from) return false;
  const name = (o.fromName ?? "Christian Prete Academy").replace(/[<>"\r\n]/g, "").slice(0, 60);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(o.idempotencyKey ? { "Idempotency-Key": o.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: `${name} <${from}>`,
        to: Array.isArray(o.to) ? o.to : [o.to],
        subject: o.content.subject,
        html: o.content.html,
        text: o.content.text,
        ...(o.replyTo ? { reply_to: o.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("Resend: invio non riuscito", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("Resend: invio non riuscito", e);
    return false;
  }
}
