// Pagine pubbliche raggiunte dai link nei messaggi automatici (nessun login):
//  - questionario dopo la visita: { questionario: token } → dati; { questionario: token, risposte } → salva
//  - disiscrizione dalle email: { disiscrizione: token } → esclude il contatto dalle email
// I token sono firmati (HMAC) con un segreto del Vault: non si possono indovinare né modificare.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function firma(segreto: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(segreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function verifica(segreto: string, token: string, prefisso: string) {
  const [id, sig] = String(token ?? "").split(".");
  if (!/^[0-9a-f-]{36}$/.test(id ?? "") || !sig) return null;
  const atteso = await firma(segreto, `${prefisso}:${id}`);
  if (atteso.length !== sig.length) return null;
  let d = 0;
  for (let i = 0; i < atteso.length; i++) d |= atteso.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0 ? id : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Metodo non consentito" });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: segreto } = await db.rpc("app_secret", { p_name: "automazioni_link_secret" });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Richiesta non valida" });
  }

  if (body.disiscrizione) {
    const id = await verifica(String(segreto), body.disiscrizione, "u");
    if (!id) return reply(400, { error: "Link non valido." });
    const { data: agenzia } = await db.rpc("email_opt_out", { p_contact: id });
    return reply(200, { ok: true, agenzia: agenzia ?? "" });
  }

  if (body.questionario) {
    const id = await verifica(String(segreto), body.questionario, "q");
    if (!id) return reply(400, { error: "Link non valido." });
    if (!body.risposte) {
      const { data } = await db.rpc("questionario_info", { p_appointment: id });
      if (!data) return reply(404, { error: "Questionario non trovato." });
      return reply(200, data);
    }
    const r = body.risposte;
    const { data: ok } = await db.rpc("questionario_save", {
      p_appointment: id,
      p_voto: Number(r.voto) || null,
      p_piaciuto: String(r.piaciuto ?? "").slice(0, 1000),
      p_non_piaciuto: String(r.non_piaciuto ?? "").slice(0, 1000),
      p_prezzo: String(r.prezzo ?? ""),
      p_offerta: Number(String(r.offerta ?? "").replace(/[^\d]/g, "")) || null,
      p_intenzione: String(r.intenzione ?? ""),
    });
    return ok ? reply(200, { ok: true }) : reply(410, { error: "Il questionario è già stato compilato o è scaduto." });
  }
  return reply(400, { error: "Richiesta non valida" });
});
