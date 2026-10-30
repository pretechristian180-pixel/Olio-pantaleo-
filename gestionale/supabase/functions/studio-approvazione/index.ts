// Approvazione di un video dal link ricevuto su WhatsApp, senza login.
// Il link contiene un token monouso (valido 7 giorni): nel database c'è solo la sua impronta SHA-256.
// Questa funzione è pubblica (verify_jwt = false) e usa la chiave di servizio solo per:
//  - POST { token }                         → dati per mostrare il video
//  - POST { token, esito, nota? }           → registra la decisione (approvato / modifiche / scartato)
// Qualsiasi controllo (scadenza, uso singolo, stato del video) è nelle funzioni SQL.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SCADUTO = "Il link non è più valido: è scaduto, è già stato usato oppure il video è cambiato. Apri Mattonio per vederlo.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Metodo non consentito" });

  let body: { token?: string; esito?: string; nota?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Richiesta non valida" });
  }
  const token = String(body.token ?? "");
  if (!/^[0-9a-f]{48}$/.test(token)) return reply(400, { error: SCADUTO });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // ----- Decisione -----
  if (body.esito) {
    if (!["approvato", "modifiche", "scartato"].includes(body.esito)) return reply(400, { error: "Scelta non valida" });
    const nota = String(body.nota ?? "").slice(0, 1000);
    const { error } = await admin.rpc("studio_decide_by_token", { p_token: token, p_esito: body.esito, p_nota: nota });
    if (error) {
      const msg = error.code === "42501" ? SCADUTO : error.code === "23514" ? error.message : "Non siamo riusciti a salvare la scelta. Riprova tra poco.";
      return reply(error.code === "42501" ? 410 : 400, { error: msg });
    }
    return reply(200, { ok: true });
  }

  // ----- Lettura -----
  const { data: rows, error: e1 } = await admin.rpc("studio_token_lookup", { p_token: token });
  const t = Array.isArray(rows) ? rows[0] : null;
  if (e1 || !t) return reply(410, { error: SCADUTO });

  const [{ data: v }, { data: brand }, { data: agency }, { data: slot }] = await Promise.all([
    admin
      .from("video_projects")
      .select("id, property_id, durata_target, foto_selezionate, script_intro, script_chiusura, caption, hashtag, video_url, thumbnail_url")
      .eq("id", t.video_project_id)
      .single(),
    admin.from("brand_settings").select("dicitura_ai, hashtag_fissi, piattaforme_predefinite, frase_chiusura").eq("agency_id", t.agency_id).single(),
    admin.from("agencies").select("nome, telefono").eq("id", t.agency_id).single(),
    admin.rpc("studio_next_slot", { p_agency: t.agency_id }),
  ]);
  if (!v) return reply(410, { error: SCADUTO });

  const [{ data: p }, { data: foto }] = await Promise.all([
    admin.from("properties").select("titolo, indirizzo, citta, zona, prezzo, contratto, mq, locali").eq("id", v.property_id).single(),
    admin.from("property_photos").select("id, url").eq("property_id", v.property_id),
  ]);

  // Link temporanei (1 ora) alle foto scelte, nell'ordine del montaggio
  const perId = new Map((foto ?? []).map((f) => [f.id, f.url]));
  const percorsi = (v.foto_selezionate as string[]).map((id) => perId.get(id)).filter((x): x is string => !!x);
  let fotoUrl: string[] = [];
  if (percorsi.length) {
    const { data: firmati } = await admin.storage.from("property-photos").createSignedUrls(percorsi, 3600);
    fotoUrl = (firmati ?? []).map((f) => f.signedUrl).filter((x): x is string => !!x);
  }

  return reply(200, {
    agenzia: agency?.nome ?? "",
    telefono: agency?.telefono ?? null,
    immobile: p,
    video: {
      durata: v.durata_target,
      intro: v.script_intro,
      chiusura: v.script_chiusura,
      caption: v.caption,
      hashtag: [...new Set([...(v.hashtag ?? []), ...(brand?.hashtag_fissi ?? [])])],
      video_url: v.video_url,
      foto: fotoUrl,
    },
    dicitura_ai: brand?.dicitura_ai ?? "",
    piattaforme: brand?.piattaforme_predefinite ?? [],
    pubblica_alle: slot ?? null,
  });
});
