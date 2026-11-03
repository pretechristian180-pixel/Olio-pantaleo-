// Ingresso dei lead. Tutti finiscono in public.lead_ingest (service role): pulizia, doppioni,
// punteggio, assegnazione, contatto, cosa da fare e automazioni (risposta subito, allarme).
//
//  - POST { azione: "sito", token, nome, telefono, email, messaggio, privacy, ... }  (JSON o modulo HTML)
//      Modulo del sito dell'agenzia. Pubblico: campo trappola anti-bot, consenso privacy obbligatorio,
//      limite di invii per IP (nel database).
//  - GET  ?hub.mode=subscribe…   verifica del webhook Meta (META_VERIFY_TOKEN)
//  - POST firmato da Meta (X-Hub-Signature-256 con META_APP_SECRET): Lead Ads di Facebook e Instagram.
//      Il lead si legge con l'API Graph ufficiale e il token della pagina, che sta nel Vault.
//  - POST { azione: "meta_avvia" } (titolare collegato) → indirizzo per collegare le pagine Facebook
//  - GET  ?azione=meta_ritorno&code&state  ritorno da Facebook: i token restano qui e vanno nel Vault
//  - POST ?azione=email&chiave=LEAD_EMAIL_SECRET  email dei portali inoltrate a lead-<codice>@LEAD_EMAIL_DOMAIN
//      (servizio di posta in arrivo: Postmark, CloudMailin o simili). Lettura con l'AI se c'è ANTHROPIC_API_KEY.
//  - POST { azione: "stato" } (titolare) → cosa è attivo, codice del modulo e indirizzo email dei portali
import Anthropic from "npm:@anthropic-ai/sdk@0.134.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? "";
const GRAPH = `https://graph.facebook.com/${env("META_GRAPH_VERSION") || "v24.0"}`;
const fnUrl = () => `${env("SUPABASE_URL")}/functions/v1/lead-ingresso`;

const uguali = (a: string, b: string) => a.length === b.length && [...a].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const txt = (v: unknown, max = 300) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function admin() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
}

/** Titolare collegato: restituisce l'agenzia, altrimenti null */
async function titolare(db: SupabaseClient, req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data } = await db.auth.getUser(token);
  if (!data?.user) return null;
  const { data: p } = await db.from("profiles").select("agency_id, ruolo, attivo").eq("id", data.user.id).maybeSingle();
  return p?.attivo && p.ruolo === "titolare" ? (p.agency_id as string) : null;
}

const pagina = (titolo: string, testo: string) =>
  new Response(
    `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titolo}</title>` +
      `<body style="font-family:system-ui,sans-serif;background:#F6F4F0;color:#16202E;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">` +
      `<div style="max-width:420px;background:#fff;border-radius:12px;padding:28px;text-align:center"><h1 style="font-size:22px">${titolo}</h1><p style="font-size:17px;line-height:1.5">${testo}</p></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const db = admin();

  // ---------- Meta: verifica del webhook ----------
  if (req.method === "GET" && url.searchParams.get("hub.mode") === "subscribe") {
    const ok = env("META_VERIFY_TOKEN") && url.searchParams.get("hub.verify_token") === env("META_VERIFY_TOKEN");
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "") : new Response("Forbidden", { status: 403 });
  }
  // ---------- Meta: ritorno dal collegamento delle pagine ----------
  if (req.method === "GET" && url.searchParams.get("azione") === "meta_ritorno") return metaRitorno(db, url);
  if (req.method !== "POST") return json(405, { error: "Metodo non consentito" });

  // ---------- Meta: lead in arrivo (firmati) ----------
  if (req.headers.get("x-hub-signature-256")) return metaWebhook(db, req);
  // ---------- Email dei portali ----------
  if (url.searchParams.get("azione") === "email") return emailInArrivo(db, req, url);

  const tipo = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  try {
    body = tipo.includes("application/json") ? await req.json() : Object.fromEntries(await req.formData());
  } catch {
    return json(400, { error: "Richiesta non valida" });
  }
  const modulo = !tipo.includes("application/json");

  if (body.azione === "stato" || body.azione === "meta_avvia") {
    const agenzia = await titolare(db, req);
    if (!agenzia) return json(403, { error: "Solo il titolare può gestire i lead in arrivo." });
    if (body.azione === "stato") {
      const { data: s } = await db.from("lead_settings").select("token").eq("agency_id", agenzia).maybeSingle();
      const dominio = env("LEAD_EMAIL_DOMAIN");
      return json(200, {
        token: s?.token ?? null,
        indirizzo_modulo: fnUrl(),
        email: dominio && env("LEAD_EMAIL_SECRET") ? `lead-${s?.token}@${dominio}` : null,
        meta_attivo: !!(env("META_APP_ID") && env("META_APP_SECRET")),
        ai_email: !!env("ANTHROPIC_API_KEY"),
      });
    }
    if (!env("META_APP_ID") || !env("META_APP_SECRET")) return json(501, { error: "Collegamento a Facebook non ancora configurato." });
    const stato = btoa(JSON.stringify({ a: agenzia, t: Date.now() }));
    const firma = await hmac(env("META_APP_SECRET"), stato);
    const q = new URLSearchParams({
      client_id: env("META_APP_ID"),
      redirect_uri: `${fnUrl()}?azione=meta_ritorno`,
      state: `${stato}.${firma}`,
      scope: "pages_show_list,pages_read_engagement,pages_manage_metadata,leads_retrieval,business_management",
    });
    return json(200, { url: `https://www.facebook.com/${env("META_GRAPH_VERSION") || "v24.0"}/dialog/oauth?${q}` });
  }

  if (body.azione === "sito" || body.token) return moduloSito(db, req, body, modulo);
  return json(400, { error: "Azione sconosciuta" });
});

/* ---------- Modulo del sito ---------- */
async function moduloSito(db: SupabaseClient, req: Request, b: Record<string, unknown>, modulo: boolean) {
  const fine = (ok: boolean, messaggio: string, status = 200) => {
    if (!modulo) return json(ok ? 200 : status, ok ? { ok: true, messaggio } : { error: messaggio });
    const ritorno = txt(b.ritorno, 500);
    if (ok && /^https:\/\//.test(ritorno)) return Response.redirect(ritorno, 303);
    return pagina(ok ? "Grazie!" : "Non inviato", messaggio);
  };
  // Campo trappola: le persone non lo vedono, i bot lo riempiono
  if (txt(b.sito_web)) return fine(true, "Richiesta ricevuta: ti ricontattiamo al più presto.");
  const agenzia = await db.rpc("lead_agenzia_da_token", { p_token: txt(b.token, 40) });
  if (!agenzia.data) return fine(false, "Modulo non configurato correttamente.", 404);
  if (!(b.privacy === true || b.privacy === "true" || b.privacy === "on" || b.privacy === "1")) {
    return fine(false, "Per inviare la richiesta serve il consenso al trattamento dei dati.", 400);
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const { error } = await db.rpc("lead_ingest", {
    p_agency: agenzia.data,
    p_canale: "sito",
    p_dati: {
      nome: txt(b.nome, 80), cognome: txt(b.cognome, 80), nome_completo: txt(b.nome_completo, 160),
      telefono: txt(b.telefono, 40), email: txt(b.email, 160), messaggio: String(b.messaggio ?? "").slice(0, 3000),
      riferimento: txt(b.riferimento, 200), property_id: txt(b.immobile, 40), privacy: true,
      ip_hash: ip ? await sha256(`${ip}|${new Date().toISOString().slice(0, 10)}|${txt(b.token)}`) : null,
      grezzi: { pagina: txt(b.pagina, 300) },
    },
  });
  if (error) {
    const msg = /telefono o un/.test(error.message) ? "Lascia un telefono o un'email per essere ricontattato."
      : /Troppi invii/.test(error.message) ? "Hai già inviato alcune richieste: riprova tra qualche minuto."
      : "Non è stato possibile inviare la richiesta. Riprova più tardi.";
    if (!/telefono o un|Troppi invii/.test(error.message)) console.error("lead sito:", error.message);
    return fine(false, msg, /Troppi/.test(error.message) ? 429 : 400);
  }
  return fine(true, "Richiesta ricevuta: ti ricontattiamo al più presto.");
}

/* ---------- Facebook e Instagram Lead Ads ---------- */
async function metaWebhook(db: SupabaseClient, req: Request) {
  const raw = await req.text();
  const segreto = env("META_APP_SECRET");
  const firma = req.headers.get("x-hub-signature-256") ?? "";
  if (!segreto || !firma.startsWith("sha256=") || !uguali(firma.slice(7), await hmac(segreto, raw))) {
    return new Response("Invalid signature", { status: 401 });
  }
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("ok");
  }
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== "leadgen") continue;
      const v = change.value ?? {};
      try {
        await leggiLeadMeta(db, String(v.page_id ?? entry.id ?? ""), String(v.leadgen_id ?? ""));
      } catch (e) {
        console.error("lead meta:", String(e));
      }
    }
  }
  return new Response("ok"); // Meta vuole sempre una risposta 200 veloce
}

async function leggiLeadMeta(db: SupabaseClient, paginaId: string, leadgenId: string) {
  if (!/^\d+$/.test(paginaId) || !/^\d+$/.test(leadgenId)) return;
  const { data: rec } = await db.rpc("lead_meta_token", { p_pagina: paginaId });
  if (!rec?.token) return;
  const res = await fetch(`${GRAPH}/${leadgenId}?fields=field_data,platform,ad_name,form_id,created_time&access_token=${encodeURIComponent(rec.token)}`);
  const lead = await res.json();
  if (!res.ok) {
    if (lead?.error?.code === 190) await db.rpc("lead_meta_da_ricollegare", { p_pagina: paginaId });
    throw new Error(lead?.error?.message ?? `Graph ${res.status}`);
  }
  const campi: Record<string, string> = {};
  const altro: string[] = [];
  for (const f of lead.field_data ?? []) {
    const nome = String(f.name ?? "").toLowerCase();
    const valore = (f.values ?? []).join(", ");
    if (["full_name", "first_name", "last_name", "phone_number", "email"].includes(nome)) campi[nome] = valore;
    else if (valore) altro.push(`${String(f.name).replace(/_/g, " ")}: ${valore}`);
  }
  const { error } = await db.rpc("lead_ingest", {
    p_agency: rec.agency_id,
    p_canale: lead.platform === "ig" ? "instagram" : "facebook",
    p_dati: {
      nome: campi.first_name ?? "", cognome: campi.last_name ?? "", nome_completo: campi.full_name ?? "",
      telefono: campi.phone_number ?? "", email: campi.email ?? "",
      messaggio: altro.join("\n"), riferimento: txt(lead.ad_name, 200),
      portale: lead.platform === "ig" ? "Instagram" : "Facebook", esterno_id: `meta_${leadgenId}`, privacy: true,
      grezzi: { form_id: lead.form_id ?? null, ad_name: lead.ad_name ?? null, created_time: lead.created_time ?? null },
    },
  });
  if (error && !/telefono o un/.test(error.message)) throw new Error(error.message);
}

async function metaRitorno(db: SupabaseClient, url: URL) {
  const app = env("APP_URL").replace(/\/$/, "");
  const torna = (esito: string) => (app ? Response.redirect(`${app}/impostazioni/lead?meta=${esito}`, 303) : pagina("Facebook", esito === "ok" ? "Pagine collegate. Puoi chiudere questa finestra." : "Collegamento non riuscito."));
  try {
    const [stato, firma] = (url.searchParams.get("state") ?? "").split(".");
    if (!stato || !firma || !uguali(firma, await hmac(env("META_APP_SECRET"), stato))) return torna("errore");
    const { a: agenzia, t } = JSON.parse(atob(stato));
    if (Date.now() - Number(t) > 30 * 60_000) return torna("scaduto");
    const code = url.searchParams.get("code");
    if (!code) return torna("annullato");
    const base = { client_id: env("META_APP_ID"), client_secret: env("META_APP_SECRET") };
    const breve = await (await fetch(`${GRAPH}/oauth/access_token?${new URLSearchParams({ ...base, redirect_uri: `${fnUrl()}?azione=meta_ritorno`, code })}`)).json();
    if (!breve.access_token) return torna("errore");
    const lungo = await (await fetch(`${GRAPH}/oauth/access_token?${new URLSearchParams({ ...base, grant_type: "fb_exchange_token", fb_exchange_token: breve.access_token })}`)).json();
    const userToken = lungo.access_token ?? breve.access_token;
    const pagine = await (await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=50&access_token=${encodeURIComponent(userToken)}`)).json();
    let n = 0;
    for (const p of pagine.data ?? []) {
      if (!p.access_token) continue;
      const sub = await fetch(`${GRAPH}/${p.id}/subscribed_apps`, {
        method: "POST",
        body: new URLSearchParams({ subscribed_fields: "leadgen", access_token: p.access_token }),
      });
      if (!sub.ok) continue;
      const { error } = await db.rpc("lead_meta_salva", { p_agency: agenzia, p_pagina: String(p.id), p_nome: String(p.name ?? "Pagina"), p_instagram: !!p.instagram_business_account, p_token: p.access_token });
      if (!error) n++;
    }
    return torna(n ? "ok" : "nessuna_pagina");
  } catch (e) {
    console.error("meta ritorno:", String(e));
    return torna("errore");
  }
}

/* ---------- Email dei portali ---------- */
const PORTALI: [RegExp, string][] = [
  [/immobiliare\.it/i, "Immobiliare.it"],
  [/idealista/i, "Idealista"],
  [/casa\.it/i, "Casa.it"],
  [/subito\.it/i, "Subito.it"],
  [/wikicasa/i, "Wikicasa"],
  [/trovacasa/i, "Trovacasa"],
  [/gate-away/i, "Gate-away"],
];
const daHtml = (h: string) =>
  h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();

function estraiConRegole(testo: string) {
  const riga = (re: RegExp) => testo.match(re)?.[1]?.trim() ?? "";
  const emails = [...testo.matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)].map((m) => m[0]).filter((e) => !/(noreply|no-reply|immobiliare|idealista|casa\.it|subito|wikicasa|notifiche|info@)/i.test(e));
  const tel = testo.match(/(?:\+39|0039)?[\s.]?(3\d{2}|0\d{1,3})[\s./-]?\d{3}[\s./-]?\d{3,4}/)?.[0] ?? "";
  return {
    nome_completo: riga(/(?:nome e cognome|nominativo|nome|da)\s*:\s*([^\n]{2,80})/i),
    telefono: riga(/(?:telefono|cellulare|tel\.?)\s*:\s*([+\d\s./-]{6,25})/i) || tel,
    email: riga(/e-?mail\s*:\s*([\w.+-]+@[\w.-]+)/i) || emails[0] || "",
    messaggio: riga(/messaggio\s*:\s*([\s\S]{2,1500}?)(?:\n\s*\n|$)/i),
    riferimento: riga(/(?:rif\.?|riferimento|codice annuncio|cod\.)\s*:?\s*([^\n]{3,80})/i),
  };
}

async function estraiConAI(oggetto: string, testo: string) {
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const campo = { type: "string" };
  const r = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1500,
    betas: ["server-side-fallback-2026-07-01"],
    // @ts-ignore: parametro beta del server (fallback automatico in caso di rifiuto)
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object", additionalProperties: false,
          required: ["nome", "cognome", "telefono", "email", "messaggio", "riferimento", "e_un_lead"],
          properties: { nome: campo, cognome: campo, telefono: campo, email: campo, messaggio: campo, riferimento: campo, e_un_lead: { type: "boolean" } },
        },
      },
    },
    system:
      "Ricevi un'email che un portale immobiliare italiano manda all'agenzia quando una persona chiede informazioni su un annuncio. " +
      "Estrai i dati della PERSONA interessata (non del portale né dell'agenzia): nome, cognome, telefono, email, il suo messaggio " +
      "e il riferimento dell'annuncio (codice, titolo o indirizzo). Stringa vuota se un dato manca. e_un_lead=false se l'email non è una richiesta di una persona (newsletter, fatture, avvisi).",
    messages: [{ role: "user", content: `Oggetto: ${oggetto}\n\n${testo.slice(0, 12000)}` }],
  });
  if (r.stop_reason === "refusal") return null;
  const t = r.content.find((c: { type: string }) => c.type === "text") as { text?: string } | undefined;
  return JSON.parse(t?.text ?? "null");
}

async function emailInArrivo(db: SupabaseClient, req: Request, url: URL) {
  const segreto = env("LEAD_EMAIL_SECRET");
  if (!segreto || !uguali(url.searchParams.get("chiave") ?? "", segreto)) return json(401, { error: "Non autorizzato" });
  let b: any;
  try {
    b = await req.json();
  } catch {
    return json(400, { error: "Formato non valido" });
  }
  // Postmark, CloudMailin o formato semplice { from, to, subject, text, html }
  const da = String(b.From ?? b.headers?.from ?? b.from ?? "");
  const a = String(b.OriginalRecipient ?? b.To ?? b.envelope?.to ?? b.to ?? "");
  const oggetto = txt(b.Subject ?? b.headers?.subject ?? b.subject, 300);
  const corpo = String(b.TextBody ?? b.plain ?? b.text ?? "") || daHtml(String(b.HtmlBody ?? b.html ?? ""));
  const idMessaggio = txt(b.MessageID ?? b.headers?.message_id ?? b.message_id ?? "", 200);

  const codice = url.searchParams.get("agenzia") ?? a.match(/lead-([0-9a-f]{12,40})@/i)?.[1] ?? "";
  const agenzia = await db.rpc("lead_agenzia_da_token", { p_token: codice });
  if (!agenzia.data) return json(200, { ok: false, motivo: "Agenzia non trovata" });

  const tutto = `${da}\n${oggetto}\n${corpo}`;
  const portale = PORTALI.find(([re]) => re.test(tutto))?.[1] ?? "";
  let d: Record<string, unknown> = estraiConRegole(corpo);
  if (env("ANTHROPIC_API_KEY")) {
    try {
      const ai = await estraiConAI(oggetto, `Mittente: ${da}\n\n${corpo}`);
      if (ai && ai.e_un_lead === false) return json(200, { ok: false, motivo: "Non è una richiesta" });
      if (ai) d = { ...d, ...Object.fromEntries(Object.entries(ai).filter(([, v]) => typeof v === "string" && v)), nome_completo: "" };
    } catch (e) {
      console.error("lead email AI:", String(e));
    }
  }
  const { data, error } = await db.rpc("lead_ingest", {
    p_agency: agenzia.data,
    p_canale: portale ? "portale" : "email",
    p_dati: { ...d, portale: portale || null, esterno_id: idMessaggio ? `email_${idMessaggio}` : null, grezzi: { oggetto, mittente: txt(da, 200) } },
  });
  if (error) {
    if (!/telefono o un/.test(error.message)) console.error("lead email:", error.message);
    return json(200, { ok: false, motivo: error.message });
  }
  return json(200, { ok: true, lead: data });
}
