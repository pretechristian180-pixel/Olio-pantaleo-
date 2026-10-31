// Motore delle automazioni: ogni 5 minuti (pg_cron) crea le esecuzioni "a calendario", prende quelle scadute
// e le esegue. Il database decide se e quando (automation_prepare); qui si inviano i messaggi.
// WhatsApp → se non possibile (modello non approvato, numero non collegato, contatto escluso) email → altrimenti
// una cosa da fare per l'agente, così nessun cliente resta senza risposta.
// Chiamata anche dal titolare (con la sua sessione) per aggiornare lo stato dei modelli WhatsApp da Meta.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { compila, firma, parametri, ResendEmail, WhatsAppCloud } from "./providers.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
const wa = new WhatsAppCloud(Deno.env.get("WHATSAPP_TOKEN"));
const email = new ResendEmail(Deno.env.get("RESEND_API_KEY"), Deno.env.get("EMAIL_FROM"));

const uguali = (a: string, b: string) => a.length === b.length && [...a].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Metodo non consentito" });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // ----- Titolare: aggiorna lo stato dei modelli WhatsApp da Meta -----
  if (!req.headers.get("x-automazioni-cron")) {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await db.auth.getUser(token);
    if (!auth?.user) return reply(401, { error: "Sessione scaduta: accedi di nuovo." });
    const { data: prof } = await db.from("profiles").select("agency_id, ruolo, attivo").eq("id", auth.user.id).maybeSingle();
    if (!prof?.attivo || prof.ruolo !== "titolare") return reply(403, { error: "Solo il titolare può farlo." });
    const waba = Deno.env.get("WHATSAPP_WABA_ID");
    if (!wa.pronto || !waba) return reply(400, { error: "WhatsApp non è ancora collegato: mancano le chiavi sul server." });
    try {
      const stati = await wa.statiModelli(waba);
      const { data: modelli } = await db.from("message_templates").select("id, whatsapp_template_name").eq("agency_id", prof.agency_id).eq("canale", "whatsapp");
      let aggiornati = 0;
      for (const m of modelli ?? []) {
        const s = m.whatsapp_template_name ? stati.get(m.whatsapp_template_name) : undefined;
        const stato = s === "APPROVED" ? "approvato" : s === "REJECTED" ? "rifiutato" : s ? "in_revisione" : "bozza";
        await db.from("message_templates").update({ whatsapp_template_stato: stato }).eq("id", m.id);
        aggiornati++;
      }
      return reply(200, { ok: true, aggiornati });
    } catch (e) {
      return reply(502, { error: "Meta non ha risposto. Riprova tra poco.", dettaglio: String(e).slice(0, 300) });
    }
  }

  // ----- pg_cron -----
  const { data: segreto } = await db.rpc("app_secret", { p_name: "automazioni_cron_secret" });
  if (!segreto || !uguali(req.headers.get("x-automazioni-cron")!, String(segreto))) return reply(401, { error: "Non autorizzato" });
  const { data: linkSecret } = await db.rpc("app_secret", { p_name: "automazioni_link_secret" });

  await db.rpc("automation_sweep");
  const { data: runs } = await db.rpc("automation_claim", { p_limite: 50 });
  const inizio = Date.now();
  let fatte = 0;

  for (const run of (runs ?? []) as { id: string; tentativi: number }[]) {
    if (Date.now() - inizio > 45_000) break;
    try {
      await esegui(db, run, String(linkSecret ?? ""));
      fatte++;
    } catch (e) {
      console.error(`automazioni ${run.id}: ${String(e)}`);
      if (run.tentativi >= 3) await db.rpc("automation_finish", { p_run: run.id, p_stato: "fallita", p_motivo: String(e).slice(0, 300), p_canale: null, p_testo: null, p_task_aggiuntivo: null });
      else await db.rpc("automation_postpone", { p_run: run.id, p_quando: new Date(Date.now() + 15 * 60_000).toISOString(), p_motivo: "Errore temporaneo, riprovo" });
    }
  }
  return reply(200, { ok: true, eseguite: fatte });
});

// deno-lint-ignore no-explicit-any
async function esegui(db: any, run: { id: string; tentativi: number }, linkSecret: string) {
  const { data: p, error } = await db.rpc("automation_prepare", { p_run: run.id });
  if (error) throw new Error(error.message);
  const fine = (stato: string, motivo: string | null, canale: string | null, testo: string | null, extra: string | null = null) =>
    db.rpc("automation_finish", { p_run: run.id, p_stato: stato, p_motivo: motivo, p_canale: canale, p_testo: testo, p_task_aggiuntivo: extra });

  if (p.esito === "annulla") return fine("annullata", p.motivo, null, null);
  if (p.esito === "salta") return fine("saltata", p.motivo, null, null);
  if (p.esito === "rimanda") return db.rpc("automation_postpone", { p_run: run.id, p_quando: p.quando, p_motivo: p.motivo });

  const vars: Record<string, string> = { ...(p.vars ?? {}) };
  if (p.questionario_appuntamento) {
    const t = `${p.questionario_appuntamento}.${await firma(linkSecret, `q:${p.questionario_appuntamento}`)}`;
    vars.link_questionario = APP_URL ? `${APP_URL}/questionario/${t}` : "rispondi pure a questo messaggio";
  }
  const extra = p.contenuto?.task_aggiuntivo ? compila(p.contenuto.task_aggiuntivo, vars) : null;

  // Azioni interne: cosa da fare, avviso, temperatura, appuntamento
  if (!["whatsapp", "email"].includes(p.canale)) {
    return fine("eseguita", null, p.canale, compila(p.contenuto?.titolo ?? p.automazione, vars), extra);
  }

  const d = p.destinatario;
  const m = p.modello;
  const testo = compila(m.testo, vars);
  const disiscrizione = APP_URL ? `${APP_URL}/disiscrizione/${d.id}.${await firma(linkSecret, `u:${d.id}`)}` : null;
  const oggetto = compila(m.oggetto ?? p.automazione, vars);

  const viaEmail = async (motivo: string | null) => {
    const r = await email.invia({ a: d.email, oggetto, testo, nomeMittente: vars.nome_agenzia ?? "Mattonio", rispondiA: p.email_risposta, disiscrizione });
    if (r.ok) return fine("eseguita", motivo, "email", testo, extra);
    if (r.riprova && run.tentativi < 3) return db.rpc("automation_postpone", { p_run: run.id, p_quando: new Date(Date.now() + 15 * 60_000).toISOString(), p_motivo: r.errore });
    return aMano(`Email non inviata (${r.errore})`);
  };
  const aMano = (motivo: string) =>
    fine("eseguita", motivo, "task", `Scrivi a ${d.nome}${d.telefono ? ` (${d.telefono})` : ""}: ${testo}`.slice(0, 300), extra);
  const emailPossibile = email.pronto && !!d.email && !d.escluso_email;

  if (p.canale === "whatsapp") {
    if (d.escluso_whatsapp) return emailPossibile ? viaEmail("Escluso da WhatsApp: inviata email") : fine("saltata", "Contatto escluso dai messaggi WhatsApp", null, null);
    const perche =
      !wa.pronto ? "WhatsApp non collegato" :
      !p.whatsapp_phone_number_id ? "Numero WhatsApp dell'agenzia non impostato" :
      m.whatsapp_stato !== "approvato" || !m.whatsapp_nome ? "Modello WhatsApp non ancora approvato da Meta" :
      !d.telefono ? "Contatto senza telefono" : null;
    if (!perche) {
      const r = await wa.inviaModello({ phoneNumberId: p.whatsapp_phone_number_id, a: d.telefono, modello: m.whatsapp_nome, parametri: parametri(m.testo, vars) });
      if (r.ok) return fine("eseguita", null, "whatsapp", testo, extra);
      if (r.riprova && run.tentativi < 3) return db.rpc("automation_postpone", { p_run: run.id, p_quando: new Date(Date.now() + 15 * 60_000).toISOString(), p_motivo: r.errore });
      return emailPossibile ? viaEmail(`WhatsApp non riuscito: inviata email`) : aMano(`WhatsApp non riuscito (${r.errore})`);
    }
    return emailPossibile ? viaEmail(`${perche}: inviata email`) : aMano(perche);
  }

  // Email
  if (d.escluso_email) return fine("saltata", "Contatto escluso dalle email", null, null);
  if (emailPossibile) return viaEmail(null);
  return aMano(!email.pronto ? "Email non collegata" : "Contatto senza email");
}
