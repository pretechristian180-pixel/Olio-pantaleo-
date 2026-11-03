// Report PDF per i proprietari.
//  - POST { azione: "prepara", property_id, commento?, portali? }  (chi segue l'immobile) → crea report e PDF
//  - POST { azione: "link", id }         (chi segue l'immobile) → link firmato al PDF (10 minuti)
//  - POST { azione: "invia_email", id }  (chi segue l'immobile) → email al proprietario con il PDF allegato
//  - POST { azione: "automatico", property_id }  (Edge Function "automazioni", con il segreto del Vault)
//  - POST { azione: "apri", t } / GET ?azione=apri&t=…  (pubblico, dal link nel messaggio) → registra l'apertura
// I PDF stanno nel bucket privato "report"; fuori escono solo link firmati a tempo.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { creaPdf } from "./pdf.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automazioni-cron",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? "";
const uguali = (a: string, b: string) => a.length === b.length && [...a].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const utente = (req: Request) =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

function linkPubblico(token: string) {
  const app = env("APP_URL").replace(/\/$/, "");
  return app ? `${app}/report/${token}` : `${env("SUPABASE_URL")}/functions/v1/report-proprietari?azione=apri&t=${token}`;
}

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Costruisce il PDF del report e lo salva nel bucket */
async function generaPdf(db: SupabaseClient, id: string) {
  const { data: r, error } = await db.rpc("report_per_pdf", { p_report: id });
  if (error || !r) throw new Error(error?.message ?? "Report non trovato");
  const scarica = async (bucket: string, path: string | null | undefined) => {
    if (!path) return null;
    const { data } = await db.storage.from(bucket).download(path);
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  };
  const foto = await scarica("property-photos", r.dati?.immobile?.foto);
  const logoPath: string | null = r.dati?.agenzia?.logo ?? null;
  const logoBytes = logoPath && /\.(png|jpe?g)$/i.test(logoPath) ? await scarica("agency-logos", logoPath) : null;
  const pdf = await creaPdf(
    { dati: r.dati, commento: r.commento, portali: r.portali ?? {}, creato: r.creato },
    { foto, logo: logoBytes ? { bytes: logoBytes, tipo: /\.png$/i.test(logoPath!) ? "png" : "jpg" } : null },
  );
  const path = `${r.agency_id}/${id}.pdf`;
  const up = await db.storage.from("report").upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(up.error.message);
  await db.rpc("report_imposta_pdf", { p_report: id, p_path: path });
  return { path, token: r.token as string, pdf, dati: r.dati };
}

const firmato = async (db: SupabaseClient, path: string, secondi: number) => {
  const { data } = await db.storage.from("report").createSignedUrl(path, secondi);
  return data?.signedUrl ?? null;
};

const pagina = (titolo: string, testo: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titolo}</title>` +
      `<body style="font-family:system-ui,sans-serif;background:#F6F4F0;color:#16202E;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">` +
      `<div style="max-width:420px;background:#fff;border-radius:12px;padding:28px;text-align:center"><h1 style="font-size:22px">${titolo}</h1><p style="font-size:17px;line-height:1.5">${testo}</p></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const db = admin();

  // ---------- Il proprietario apre il link (anche senza l'app) ----------
  if (req.method === "GET" && url.searchParams.get("azione") === "apri") {
    const { data } = await db.rpc("report_apri", { p_token: (url.searchParams.get("t") ?? "").slice(0, 80) });
    const link = data?.pdf_path ? await firmato(db, data.pdf_path, 3600) : null;
    return link ? Response.redirect(link, 302) : pagina("Report non disponibile", "Il link non è valido. Chieda all'agenzia di inviarglielo di nuovo.", 404);
  }
  if (req.method !== "POST") return json(405, { error: "Metodo non consentito" });

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Richiesta non valida" });
  }

  try {
    if (body.azione === "apri") {
      const { data } = await db.rpc("report_apri", { p_token: String(body.t ?? "").slice(0, 80) });
      const link = data?.pdf_path ? await firmato(db, data.pdf_path, 3600) : null;
      if (!link) return json(404, { error: "Report non disponibile" });
      return json(200, { url: link, agenzia: data.agenzia, indirizzo: data.indirizzo, dal: data.dal, al: data.al });
    }

    // ---------- Dalle automazioni (ogni 15 giorni) ----------
    if (body.azione === "automatico") {
      const { data: segreto } = await db.rpc("app_secret", { p_name: "automazioni_cron_secret" });
      if (!segreto || !uguali(req.headers.get("x-automazioni-cron") ?? "", String(segreto))) return json(401, { error: "Non autorizzato" });
      const { data: r, error } = await db.rpc("report_crea_auto", { p_property: String(body.property_id ?? "") });
      if (error) return json(400, { error: error.message });
      if (!r.pdf_path) await generaPdf(db, r.id);
      return json(200, { id: r.id, link: linkPubblico(r.token) });
    }

    // ---------- Dall'app: serve una sessione ----------
    const u = utente(req);
    const { data: auth } = await u.auth.getUser();
    if (!auth?.user) return json(401, { error: "Sessione scaduta: accedi di nuovo." });

    if (body.azione === "prepara") {
      const { data: id, error } = await u.rpc("report_crea", {
        p_property: String(body.property_id ?? ""),
        p_commento: body.commento ? String(body.commento).slice(0, 2000) : null,
        p_portali: body.portali && typeof body.portali === "object" ? body.portali : {},
      });
      if (error) return json(403, { error: error.message });
      const g = await generaPdf(db, id as string);
      return json(200, { id, link: linkPubblico(g.token), pdf: await firmato(db, g.path, 600) });
    }

    // Report visibile a questo utente? (RLS: titolare o chi segue l'immobile)
    const { data: rep } = await u.from("owner_reports").select("id, pdf_path, token, contact_id, agency_id, dati").eq("id", String(body.id ?? "")).maybeSingle();
    if (!rep) return json(404, { error: "Report non trovato" });

    if (body.azione === "link") {
      const path = rep.pdf_path ?? (await generaPdf(db, rep.id)).path;
      return json(200, { pdf: await firmato(db, path, 600), link: linkPubblico(rep.token) });
    }

    if (body.azione === "invia_email") {
      if (!env("RESEND_API_KEY") || !env("EMAIL_FROM")) return json(501, { error: "L'invio delle email non è ancora collegato." });
      const { data: c } = await db.from("contacts").select("nome, email").eq("id", rep.contact_id ?? "").maybeSingle();
      if (!c?.email) return json(400, { error: "Il proprietario non ha un'email: aggiungila nella sua scheda o invia su WhatsApp." });
      const path = rep.pdf_path ?? (await generaPdf(db, rep.id)).path;
      const { data: file } = await db.storage.from("report").download(path);
      if (!file) return json(500, { error: "PDF non trovato" });
      const d = rep.dati ?? {};
      const indirizzo = String(env("EMAIL_FROM").match(/<([^>]+)>/)?.[1] ?? env("EMAIL_FROM"));
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${String(d.agenzia?.nome ?? "Mattonio").replace(/[<>"]/g, "")} <${indirizzo}>`,
          to: [c.email],
          reply_to: d.agenzia?.email || undefined,
          subject: `Come sta andando il suo immobile in ${d.immobile?.indirizzo ?? ""}`,
          text:
            `Gentile ${c.nome},\n\nin allegato trova il report aggiornato sul suo immobile in ${d.immobile?.indirizzo ?? ""}: ` +
            `visite, impressioni dei visitatori e acquirenti interessati.\n\nPuò aprirlo anche da qui: ${linkPubblico(rep.token)}\n\n` +
            `Per qualsiasi domanda sono a sua disposizione.\n${d.agente?.nome ?? ""}${d.agente?.telefono ? ` · ${d.agente.telefono}` : ""}\n${d.agenzia?.nome ?? ""}`,
          attachments: [{ filename: `report-${String(d.immobile?.indirizzo ?? "immobile").replace(/[^\w]+/g, "-").toLowerCase()}.pdf`, content: b64(new Uint8Array(await file.arrayBuffer())) }],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) return json(502, { error: "Email non inviata, riprova tra poco.", dettaglio: (await res.text()).slice(0, 300) });
      await u.rpc("report_segna_inviato", { p_report: rep.id, p_canale: "email" });
      return json(200, { ok: true, a: c.email });
    }
    return json(400, { error: "Azione sconosciuta" });
  } catch (e) {
    console.error("report-proprietari:", String(e));
    return json(500, { error: "Il report non è stato creato. Riprova tra poco." });
  }
});
