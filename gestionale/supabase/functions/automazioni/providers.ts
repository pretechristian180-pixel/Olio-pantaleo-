// Fornitori dei messaggi. Le chiavi arrivano solo dai secrets delle Edge Functions.
// Per cambiare fornitore basta scrivere un'altra classe con la stessa interfaccia.

export type SendResult = { ok: true; id?: string } | { ok: false; errore: string; riprova: boolean };

export interface MessagingProvider {
  canale: "whatsapp" | "email";
  pronto: boolean;
}

/** WhatsApp Business Cloud API (ufficiale Meta). I messaggi inviati per primi richiedono un modello approvato. */
export class WhatsAppCloud implements MessagingProvider {
  canale = "whatsapp" as const;
  constructor(private token: string | undefined, private versione = "v21.0") {}
  get pronto() {
    return !!this.token;
  }

  async inviaModello(p: { phoneNumberId: string; a: string; modello: string; parametri: string[]; lingua?: string }): Promise<SendResult> {
    const to = p.a.replace(/\D/g, "").replace(/^00/, "");
    const numero = to.length <= 10 ? `39${to}` : to;
    try {
      const res = await fetch(`https://graph.facebook.com/${this.versione}/${encodeURIComponent(p.phoneNumberId)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numero,
          type: "template",
          template: {
            name: p.modello,
            language: { code: p.lingua ?? "it" },
            components: p.parametri.length ? [{ type: "body", parameters: p.parametri.map((t) => ({ type: "text", text: t || "-" })) }] : [],
          },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, id: body?.messages?.[0]?.id };
      return { ok: false, errore: `WhatsApp ${res.status}: ${JSON.stringify(body?.error ?? body).slice(0, 300)}`, riprova: res.status === 429 || res.status >= 500 };
    } catch (e) {
      return { ok: false, errore: `WhatsApp rete: ${String(e)}`, riprova: true };
    }
  }

  /** Stato dei modelli registrati sull'account WhatsApp Business (per aggiornare "approvato / in revisione / rifiutato") */
  async statiModelli(wabaId: string): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    let url: string | null = `https://graph.facebook.com/${this.versione}/${encodeURIComponent(wabaId)}/message_templates?fields=name,status&limit=200`;
    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(20_000) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Meta ${res.status}: ${JSON.stringify(body?.error ?? body).slice(0, 300)}`);
      for (const t of body.data ?? []) out.set(String(t.name), String(t.status));
      url = body?.paging?.next ?? null;
    }
    return out;
  }
}

/** Email con Resend (https://resend.com). Mittente: EMAIL_FROM, es. "Mattonio <notifiche@vostrodominio.it>". */
export class ResendEmail implements MessagingProvider {
  canale = "email" as const;
  constructor(private key: string | undefined, private from: string | undefined) {}
  get pronto() {
    return !!this.key && !!this.from;
  }

  async invia(p: { a: string; oggetto: string; testo: string; nomeMittente: string; rispondiA?: string | null; disiscrizione?: string | null }): Promise<SendResult> {
    const indirizzo = (this.from ?? "").match(/<([^>]+)>/)?.[1] ?? this.from ?? "";
    const footer = p.disiscrizione ? `\n\n—\nNon vuoi più ricevere queste email? ${p.disiscrizione}` : "";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${p.nomeMittente.replace(/[<>"]/g, "")} <${indirizzo}>`,
          to: [p.a],
          subject: p.oggetto,
          text: p.testo + footer,
          reply_to: p.rispondiA || undefined,
          headers: p.disiscrizione ? { "List-Unsubscribe": `<${p.disiscrizione}>` } : undefined,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, id: body?.id };
      return { ok: false, errore: `Email ${res.status}: ${JSON.stringify(body).slice(0, 300)}`, riprova: res.status === 429 || res.status >= 500 };
    } catch (e) {
      return { ok: false, errore: `Email rete: ${String(e)}`, riprova: true };
    }
  }
}

/** {{variabile}} → valore; quelle mancanti diventano vuote */
export function compila(testo: string, vars: Record<string, string>) {
  return testo.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => vars[k] ?? "").replace(/[ \t]{2,}/g, " ").trim();
}

/** Valori dei parametri {{1}}, {{2}}… del modello WhatsApp, nell'ordine in cui le variabili compaiono nel testo */
export function parametri(testo: string, vars: Record<string, string>) {
  return [...testo.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => vars[m[1]] ?? "");
}

export async function firma(segreto: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(segreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
