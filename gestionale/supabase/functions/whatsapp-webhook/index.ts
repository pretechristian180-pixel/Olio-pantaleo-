// Webhook ufficiale di WhatsApp Business (Meta).
//  - GET: verifica dell'URL (hub.verify_token = WHATSAPP_VERIFY_TOKEN)
//  - POST: messaggi in arrivo, firmati da Meta con WHATSAPP_APP_SECRET (X-Hub-Signature-256).
//    Ogni risposta finisce nella cronologia del contatto; "STOP" lo esclude dai messaggi WhatsApp automatici.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

async function firmaValida(body: string, header: string | null) {
  const secret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const atteso = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  const ricevuto = header.slice(7);
  if (ricevuto.length !== atteso.length) return false;
  let d = 0;
  for (let i = 0; i < atteso.length; i++) d |= atteso.charCodeAt(i) ^ ricevuto.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  if (!(await firmaValida(raw, req.headers.get("x-hub-signature-256")))) return new Response("Invalid signature", { status: 401 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("ok");
  }
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const v = change?.value ?? {};
      const phoneNumberId = v?.metadata?.phone_number_id;
      for (const msg of v?.messages ?? []) {
        const testo = msg?.text?.body ?? msg?.button?.text ?? msg?.interactive?.button_reply?.title ?? `[${msg?.type ?? "messaggio"}]`;
        await db.rpc("whatsapp_inbound", { p_phone_number_id: String(phoneNumberId ?? ""), p_from: String(msg?.from ?? ""), p_testo: String(testo).slice(0, 2000) });
      }
    }
  }
  // Meta vuole sempre una risposta 200 veloce
  return new Response("ok");
});
