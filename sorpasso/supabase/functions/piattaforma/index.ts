/**
 * Operazioni sugli account riservate agli amministratori della piattaforma.
 * Verifica il ruolo con il token dell'utente (is_platform_admin), poi usa la chiave di servizio.
 *
 *   { azione: "crea_concessionaria", azienda, piano, stato, prova_giorni?, max_utenti?, referente?, titolare, accesso }
 *   { azione: "aggiungi_utente", organization_id, nome, email, telefono?, ruolo, accesso }
 *   { azione: "reinvia_invito", user_id }
 *   { azione: "link_accesso", user_id }      → { link }   (da inviare a mano, es. WhatsApp)
 *   { azione: "nuova_password", user_id }    → { password } (mostrata una sola volta)
 *
 * accesso = "invito" (email di Supabase con link per scegliere la password)
 *         | "password" (account già attivo con password temporanea, restituita una volta sola)
 * Nel registro (platform_audit) niente password né link.
 */
import { ErroreUtente, clientServizio, clientUtente, corsHeaders, gestisciErrore, json } from "../_shared/http.ts";

const RUOLI = ["titolare", "responsabile_vendite", "venditore", "amministrazione"];
const PIANI = ["start", "pro", "dealer_ai"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PIVA = /^\d{11}$/;

const testo = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const sito = () => (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");

/** Password temporanea leggibile: 3 blocchi da 4 caratteri senza simboli ambigui. */
function passwordTemporanea() {
  const alfabeto = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(12));
  const s = Array.from(b, (x) => alfabeto[x % alfabeto.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

function persona(v: Record<string, unknown> | undefined, cosa: string) {
  const nome = testo(v?.nome, 80);
  const email = testo(v?.email, 120).toLowerCase();
  if (!nome) throw new ErroreUtente(`Inserisci il nome ${cosa}`);
  if (!EMAIL.test(email)) throw new ErroreUtente(`Email ${cosa} non valida`);
  return { nome, email, telefono: testo(v?.telefono, 30) || null };
}

type Servizio = ReturnType<typeof clientServizio>;

/** Crea l'account (invito o password temporanea). Restituisce id e, se c'è, la password. */
async function creaAccount(sb: Servizio, p: { nome: string; email: string }, accesso: string) {
  if (accesso === "password") {
    const password = passwordTemporanea();
    const { data, error } = await sb.auth.admin.createUser({ email: p.email, password, email_confirm: true, user_metadata: { nome: p.nome } });
    if (error) throw erroreAccount(error.message);
    return { userId: data.user!.id, password };
  }
  const { data, error } = await sb.auth.admin.inviteUserByEmail(p.email, { data: { nome: p.nome }, redirectTo: `${sito()}/invito` });
  if (error) throw erroreAccount(error.message);
  return { userId: data.user!.id, password: null };
}

function erroreAccount(msg: string) {
  if (/already been registered|already registered|already exists/i.test(msg)) {
    return new ErroreUtente("Questa email ha già un account Sorpasso. Usa un'altra email o contatta l'utente.");
  }
  if (/rate limit/i.test(msg)) return new ErroreUtente("Troppi inviti in poco tempo: riprova tra qualche minuto, oppure usa la password temporanea.", 429);
  console.error("[piattaforma] errore account", msg.slice(0, 80));
  return new ErroreUtente("Non è stato possibile creare l'account. Riprova.", 502);
}

async function registro(sb: Servizio, adminId: string, azione: string, organizationId: string | null, dettagli: Record<string, unknown>) {
  await sb.from("platform_audit").insert({ admin_id: adminId, azione, organization_id: organizationId, dettagli });
}

async function emailUtente(sb: Servizio, userId: string) {
  const { data, error } = await sb.auth.admin.getUserById(userId);
  if (error || !data.user?.email) throw new ErroreUtente("Utente non trovato", 404);
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  try {
    const utente = clientUtente(req);
    const { data: io } = await utente.auth.getUser();
    if (!io.user) throw new ErroreUtente("Sessione scaduta, accedi di nuovo", 401);
    const { data: admin } = await utente.rpc("is_platform_admin");
    if (admin !== true) throw new ErroreUtente("Riservato agli amministratori della piattaforma", 403);
    const adminId = io.user.id;

    const sb = clientServizio();
    const b = await req.json().catch(() => ({}));
    const accesso = b.accesso === "password" ? "password" : "invito";

    switch (b.azione) {
      case "crea_concessionaria": {
        const nome = testo(b.azienda?.nome, 120);
        const piva = testo(b.azienda?.piva, 11);
        if (!nome) throw new ErroreUtente("Inserisci il nome della concessionaria");
        if (piva && !PIVA.test(piva)) throw new ErroreUtente("La P.IVA deve avere 11 cifre");
        if (!PIANI.includes(b.piano)) throw new ErroreUtente("Piano non valido");
        const stato = b.stato === "prova" ? "prova" : "attiva";
        const giorni = Number(b.prova_giorni ?? 14);
        if (stato === "prova" && !(giorni >= 1 && giorni <= 90)) throw new ErroreUtente("La prova può durare da 1 a 90 giorni");
        const titolare = persona(b.titolare, "del titolare");

        const { data: org, error } = await sb.from("organizations").insert({
          nome, piva: piva || null,
          indirizzo: testo(b.azienda?.indirizzo) || null, comune: testo(b.azienda?.comune, 80) || null,
          telefono: testo(b.azienda?.telefono, 30) || null, email: testo(b.azienda?.email, 120) || null,
          whatsapp: testo(b.azienda?.telefono, 30) || null,
          piano: b.piano, stato,
          prova_fino_al: stato === "prova" ? new Date(Date.now() + giorni * 86_400_000).toISOString().slice(0, 10) : null,
          max_utenti: Number(b.max_utenti) > 0 ? Number(b.max_utenti) : null,
          referente_nome: testo(b.referente?.nome, 80) || titolare.nome,
          referente_email: testo(b.referente?.email, 120) || titolare.email,
          referente_telefono: testo(b.referente?.telefono, 30) || titolare.telefono,
        }).select("id").single();
        if (error) throw error;

        let account: { userId: string; password: string | null };
        try {
          account = await creaAccount(sb, titolare, accesso);
        } catch (e) {
          // Senza titolare la concessionaria non serve: la togliamo per non lasciare dati a metà
          await sb.from("organizations").delete().eq("id", org.id);
          throw e;
        }
        const { error: errProfilo } = await sb.from("profiles").insert({
          user_id: account.userId, organization_id: org.id, nome: titolare.nome, email: titolare.email,
          telefono: titolare.telefono, ruolo: "titolare",
        });
        if (errProfilo) throw errProfilo;
        await sb.rpc("crea_template_predefiniti", { p_org: org.id });
        await sb.rpc("crea_categorie_predefinite", { p_org: org.id });
        await registro(sb, adminId, "creazione_concessionaria", org.id, { piano: b.piano, stato, accesso });
        return json({ organization_id: org.id, user_id: account.userId, password: account.password });
      }

      case "aggiungi_utente": {
        const orgId = testo(b.organization_id, 40);
        if (!RUOLI.includes(b.ruolo)) throw new ErroreUtente("Ruolo non valido");
        const p = persona(b, "dell'utente");
        const { data: org } = await sb.from("organizations").select("id, max_utenti").eq("id", orgId).maybeSingle();
        if (!org) throw new ErroreUtente("Concessionaria non trovata", 404);
        if (org.max_utenti) {
          const { count } = await sb.from("profiles").select("user_id", { count: "exact", head: true }).eq("organization_id", orgId).eq("attivo", true);
          if ((count ?? 0) >= org.max_utenti) throw new ErroreUtente(`Il piano prevede al massimo ${org.max_utenti} utenti attivi: aumenta il limite o disattiva un utente.`);
        }
        const account = await creaAccount(sb, p, accesso);
        const { error } = await sb.from("profiles").insert({
          user_id: account.userId, organization_id: orgId, nome: p.nome, email: p.email, telefono: p.telefono, ruolo: b.ruolo,
        });
        if (error) throw error;
        await registro(sb, adminId, "aggiunta_utente", orgId, { user_id: account.userId, ruolo: b.ruolo, accesso });
        return json({ user_id: account.userId, password: account.password });
      }

      case "reinvia_invito": {
        const u = await emailUtente(sb, testo(b.user_id, 40));
        if (u.email_confirmed_at) throw new ErroreUtente("L'utente ha già attivato l'account: usa «Link di accesso» o «Nuova password».");
        const { error } = await sb.auth.admin.inviteUserByEmail(u.email!, { redirectTo: `${sito()}/invito` });
        if (error) throw erroreAccount(error.message);
        const { data: pr } = await sb.from("profiles").select("organization_id").eq("user_id", u.id).maybeSingle();
        await registro(sb, adminId, "reinvio_invito", pr?.organization_id ?? null, { user_id: u.id });
        return json({ ok: true });
      }

      case "link_accesso": {
        const u = await emailUtente(sb, testo(b.user_id, 40));
        const { data, error } = await sb.auth.admin.generateLink({ type: "recovery", email: u.email!, options: { redirectTo: `${sito()}/imposta-password` } });
        if (error || !data.properties?.action_link) throw new ErroreUtente("Non è stato possibile creare il link. Riprova.", 502);
        const { data: pr } = await sb.from("profiles").select("organization_id").eq("user_id", u.id).maybeSingle();
        await registro(sb, adminId, "link_accesso", pr?.organization_id ?? null, { user_id: u.id });
        return json({ link: data.properties.action_link });
      }

      case "nuova_password": {
        const u = await emailUtente(sb, testo(b.user_id, 40));
        const password = passwordTemporanea();
        const { error } = await sb.auth.admin.updateUserById(u.id, { password, email_confirm: true });
        if (error) throw new ErroreUtente("Non è stato possibile impostare la password. Riprova.", 502);
        const { data: pr } = await sb.from("profiles").select("organization_id").eq("user_id", u.id).maybeSingle();
        await registro(sb, adminId, "nuova_password", pr?.organization_id ?? null, { user_id: u.id });
        return json({ password });
      }

      default:
        throw new ErroreUtente("Azione non riconosciuta");
    }
  } catch (e) {
    return gestisciErrore(e, "piattaforma");
  }
});
