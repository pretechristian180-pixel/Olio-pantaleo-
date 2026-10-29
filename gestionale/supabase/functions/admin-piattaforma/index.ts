// Operazioni del pannello admin di Mattonio che richiedono i permessi di Supabase Auth:
// - crea_agenzia: crea l'agenzia e invita il titolare via email
// - invita_utente: invita un titolare o un agente in un'agenzia esistente
// - reinvia_invito: rimanda il link per scegliere la password
// Solo gli amministratori della piattaforma (tabella platform_admins, email confermata).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const PIANI = ["start", "pro", "elite"];
const RUOLI = ["titolare", "agente"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Metodo non consentito." });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Chi chiama deve essere un amministratore della piattaforma
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const me = auth?.user;
  if (!me?.email || !me.email_confirmed_at) return reply(401, { error: "Sessione scaduta: accedi di nuovo." });
  const { data: isAdmin } = await admin.from("platform_admins").select("email").eq("email", me.email.toLowerCase()).maybeSingle();
  if (!isAdmin) return reply(403, { error: "Riservato agli amministratori di Mattonio." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Richiesta non valida." });
  }
  const txt = (v: unknown, max = 160) => String(v ?? "").trim().slice(0, max);

  let redirectTo: string | undefined;
  try {
    const u = new URL(txt(body.redirectTo, 300));
    if (u.protocol === "https:" || u.hostname === "localhost") redirectTo = u.toString();
  } catch {
    redirectTo = undefined;
  }

  // Invita una persona in un'agenzia: registra l'invito (il database la collega all'agenzia
  // con il ruolo giusto quando nasce l'account) e manda l'email di Supabase Auth.
  async function invita(agencyId: string, email: string, nome: string, cognome: string, ruolo: string) {
    const { data: inv, error: invError } = await admin
      .from("invitations")
      .upsert(
        { agency_id: agencyId, email, nome, cognome, ruolo, invitato_da: me!.id, accepted_at: null, created_at: new Date().toISOString() },
        { onConflict: "agency_id,email" },
      )
      .select("id")
      .single();
    if (invError) return "Non sono riuscito a registrare l'invito. Riprova tra poco.";
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { nome, cognome } });
    if (!error) return null;
    await admin.from("invitations").delete().eq("id", inv.id);
    const msg = error.message.toLowerCase();
    const code = (error as { code?: string }).code;
    if (msg.includes("already") || code === "email_exists") return "Questa email ha già un account Mattonio.";
    if (msg.includes("not authorized") || code === "email_address_not_authorized")
      return "Le email non sono ancora attive: configura il server email (SMTP) nelle impostazioni di Supabase.";
    if (msg.includes("rate limit")) return "Troppe email inviate in poco tempo. Riprova tra qualche minuto.";
    return "Non sono riuscito a inviare l'email di invito. Riprova tra poco.";
  }

  const azione = txt(body.azione, 40);

  if (azione === "crea_agenzia") {
    const nome = txt(body.nome);
    const piano = txt(body.piano, 10);
    const t = (body.titolare ?? {}) as Record<string, unknown>;
    const email = txt(t.email, 200).toLowerCase();
    if (!nome) return reply(400, { error: "Scrivi il nome dell'agenzia." });
    if (!PIANI.includes(piano)) return reply(400, { error: "Scegli il piano." });
    if (!txt(t.nome)) return reply(400, { error: "Scrivi il nome del titolare." });
    if (!emailOk(email)) return reply(400, { error: "Controlla l'email del titolare." });

    const { data: agenzia, error } = await admin
      .from("agencies")
      .insert({ nome, piano, telefono: txt(body.telefono, 40) || null, email: txt(body.email, 200) || email })
      .select("id")
      .single();
    if (error) return reply(500, { error: "Non sono riuscito a creare l'agenzia. Riprova tra poco." });

    const errore = await invita(agenzia.id, email, txt(t.nome, 80), txt(t.cognome, 80), "titolare");
    if (errore) {
      await admin.from("agencies").delete().eq("id", agenzia.id);
      return reply(400, { error: errore });
    }
    return reply(200, { ok: true, agency_id: agenzia.id });
  }

  if (azione === "invita_utente") {
    const agencyId = txt(body.agency_id, 40);
    const email = txt(body.email, 200).toLowerCase();
    const ruolo = txt(body.ruolo, 10);
    if (!RUOLI.includes(ruolo)) return reply(400, { error: "Scegli il ruolo." });
    if (!txt(body.nome)) return reply(400, { error: "Scrivi il nome." });
    if (!emailOk(email)) return reply(400, { error: "Controlla l'indirizzo email." });
    const { data: agenzia } = await admin.from("agencies").select("id").eq("id", agencyId).maybeSingle();
    if (!agenzia) return reply(404, { error: "Agenzia non trovata." });
    const errore = await invita(agencyId, email, txt(body.nome, 80), txt(body.cognome, 80), ruolo);
    return errore ? reply(400, { error: errore }) : reply(200, { ok: true });
  }

  if (azione === "reinvia_invito") {
    const email = txt(body.email, 200).toLowerCase();
    if (!emailOk(email)) return reply(400, { error: "Controlla l'indirizzo email." });
    // Link per scegliere la password: vale sia per chi non ha mai fatto il primo accesso sia per chi l'ha dimenticata
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("rate limit")) return reply(429, { error: "Troppe email inviate in poco tempo. Riprova tra qualche minuto." });
      if (msg.includes("not authorized")) return reply(400, { error: "Le email non sono ancora attive: configura il server email (SMTP)." });
      return reply(500, { error: "Non sono riuscito a inviare l'email. Riprova tra poco." });
    }
    return reply(200, { ok: true });
  }

  return reply(400, { error: "Azione sconosciuta." });
});
