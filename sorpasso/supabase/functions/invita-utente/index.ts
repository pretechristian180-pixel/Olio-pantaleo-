/**
 * Invito di un collega: solo il titolare.
 *   { email, nome, ruolo: "responsabile_vendite" | "venditore" | "amministrazione" }
 * Crea la riga in invitations (con il client dell'utente: RLS verifica che sia titolare)
 * e invia l'email di Supabase Auth. Al primo accesso il trigger on_auth_user_created
 * crea il profilo con il ruolo scelto.
 */
import { ErroreUtente, clientServizio, clientUtente, corsHeaders, gestisciErrore, json, profiloCorrente } from "../_shared/http.ts";

const RUOLI = ["responsabile_vendite", "venditore", "amministrazione"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  try {
    const { email, nome, ruolo } = await req.json().catch(() => ({}));
    if (typeof email !== "string" || !EMAIL.test(email.trim())) throw new ErroreUtente("Email non valida");
    if (typeof nome !== "string" || !nome.trim()) throw new ErroreUtente("Inserisci il nome");
    if (!RUOLI.includes(ruolo)) throw new ErroreUtente("Ruolo non valido");

    const sb = clientUtente(req);
    const profilo = await profiloCorrente(sb);
    if (profilo.ruolo !== "titolare") throw new ErroreUtente("Solo il titolare può invitare colleghi", 403);

    const admin = clientServizio();
    const emailPulita = email.trim().toLowerCase();

    const { data: inv, error } = await sb
      .from("invitations")
      .insert({ email: emailPulita, nome: nome.trim(), ruolo })
      .select("token")
      .single();
    if (error) {
      if (error.code === "23505") throw new ErroreUtente("C'è già un invito in attesa per questa email");
      throw error;
    }

    const { error: errInvito } = await admin.auth.admin.inviteUserByEmail(emailPulita, {
      data: { invito_token: inv.token, nome: nome.trim() },
      redirectTo: `${Deno.env.get("SITE_URL") ?? ""}/invito`,
    });
    if (errInvito) {
      await sb.from("invitations").delete().eq("token", inv.token);
      if (/already been registered|already registered/i.test(errInvito.message)) {
        throw new ErroreUtente("Questa email ha già un account Sorpasso");
      }
      throw new ErroreUtente("Invio dell'invito non riuscito. Riprova.", 502);
    }
    return json({ ok: true });
  } catch (e) {
    return gestisciErrore(e, "invita-utente");
  }
});
