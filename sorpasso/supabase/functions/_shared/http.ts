/** Utility comuni alle Edge Function: CORS, risposte JSON, client Supabase. */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Errore con messaggio in italiano da mostrare all'utente. */
export class ErroreUtente extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Client che agisce come l'utente della richiesta: tutte le policy RLS restano attive. */
export function clientUtente(req: Request): SupabaseClient {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new ErroreUtente("Accesso richiesto", 401);
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

/** Client con privilegi di servizio: usarlo solo dopo aver verificato i permessi. */
export function clientServizio(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

export async function profiloCorrente(sb: SupabaseClient) {
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new ErroreUtente("Sessione scaduta, accedi di nuovo", 401);
  const { data, error } = await sb
    .from("profiles")
    .select("user_id, organization_id, nome, ruolo, attivo, organizations(nome)")
    .eq("user_id", u.user.id)
    .single();
  if (error || !data || !data.attivo) throw new ErroreUtente("Profilo non trovato o disattivato", 403);
  return data as unknown as {
    user_id: string;
    organization_id: string;
    nome: string;
    ruolo: "titolare" | "responsabile_vendite" | "venditore" | "amministrazione";
    organizations: { nome: string };
  };
}

/** Gestione uniforme: niente dati sensibili nei log, solo tipo di errore. */
export function gestisciErrore(e: unknown, contesto: string) {
  if (e instanceof ErroreUtente) return json({ error: e.message }, e.status);
  // Solo il tipo/codice dell'errore: mai messaggi che possono contenere dati personali.
  const codice = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : undefined;
  console.error(`[${contesto}] errore`, e instanceof Error ? e.name : typeof e, codice ?? "");
  return json({ error: "Si è verificato un errore imprevisto. Riprova tra poco." }, 500);
}
