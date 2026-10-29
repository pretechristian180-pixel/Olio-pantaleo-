/** Utilità comuni alle Edge Function. */
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { ArchivioSupabase } from "./archivio.ts";
import { leggiConfig, type Config } from "./config.ts";
import { Postino } from "./email.ts";
import { ClientFic } from "./fic.ts";
import { ClientStripe } from "./stripe.ts";
import type { Dipendenze } from "./agente.ts";

export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

export function dipendenze(config: Config = leggiConfig()): Dipendenze & { archivio: ArchivioSupabase } {
  return {
    config,
    archivio: new ArchivioSupabase(),
    stripe: new ClientStripe(config.stripeSecretKey),
    fic: new ClientFic(config.ficToken, config.ficCompanyId),
    postino: new Postino(config.resendKey, config.mittente),
  };
}

/** Confronto a tempo costante per segreti condivisi. */
export function segretoUguale(a: string | null, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** L'utente della richiesta è un amministratore? (JWT Supabase + tabella app_admins) */
export async function utenteAdmin(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: admin } = await sb.rpc("is_admin");
  return admin === true ? data.user.id : null;
}
