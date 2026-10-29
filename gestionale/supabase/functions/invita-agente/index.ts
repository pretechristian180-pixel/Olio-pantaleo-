// Invita un agente nell'agenzia del titolare che chiama la funzione.
// 1. verifica che chi chiama sia un titolare attivo
// 2. registra l'invito (serve al trigger handle_new_user per collegare l'agente all'agenzia)
// 3. invia l'email di invito di Supabase Auth: l'agente sceglie la password ed entra.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Metodo non consentito." });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return reply(401, { error: "Sessione scaduta: accedi di nuovo." });

  const { data: me } = await admin
    .from("profiles")
    .select("agency_id, ruolo, attivo")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!me || !me.attivo || me.ruolo !== "titolare") {
    return reply(403, { error: "Solo il titolare dell'agenzia può invitare nuovi agenti." });
  }

  let body: { email?: string; firstName?: string; lastName?: string; redirectTo?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Richiesta non valida." });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const nome = (body.firstName ?? "").trim().slice(0, 80);
  const cognome = (body.lastName ?? "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "Controlla l'indirizzo email." });
  if (!nome) return reply(400, { error: "Scrivi il nome dell'agente." });

  // Il link dell'email deve riportare all'app (l'indirizzo deve essere tra i Redirect URL di Supabase Auth)
  let redirectTo: string | undefined;
  try {
    const u = new URL(body.redirectTo ?? "");
    if (u.protocol === "https:" || u.hostname === "localhost") redirectTo = u.toString();
  } catch {
    redirectTo = undefined;
  }

  const { data: invitation, error: invError } = await admin
    .from("invitations")
    .upsert(
      { agency_id: me.agency_id, email, nome, cognome, invitato_da: auth.user.id, accepted_at: null, created_at: new Date().toISOString() },
      { onConflict: "agency_id,email" },
    )
    .select("id")
    .single();
  if (invError) return reply(500, { error: "Non sono riuscito a registrare l'invito. Riprova tra poco." });

  const { error: sendError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { nome, cognome },
  });

  if (sendError) {
    await admin.from("invitations").delete().eq("id", invitation.id);
    const msg = sendError.message.toLowerCase();
    if (msg.includes("already") || (sendError as { code?: string }).code === "email_exists") {
      return reply(409, { error: "Questa email ha già un account: non può essere invitata in un'altra agenzia." });
    }
    if (msg.includes("not authorized") || (sendError as { code?: string }).code === "email_address_not_authorized") {
      return reply(400, {
        error: "Le email agli agenti non sono ancora attive: serve configurare il server email (SMTP) nelle impostazioni di Supabase.",
      });
    }
    if (msg.includes("rate limit")) {
      return reply(429, { error: "Troppe email inviate in poco tempo. Riprova tra qualche minuto." });
    }
    return reply(500, { error: "Non sono riuscito a inviare l'email di invito. Riprova tra poco." });
  }

  return reply(200, { ok: true });
});
