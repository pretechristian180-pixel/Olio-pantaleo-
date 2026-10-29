const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chiave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurato = !!(url && chiave);

/**
 * Il client si scarica solo all'invio del modulo: la pagina resta leggera da telefono.
 * null se le variabili non sono configurate.
 */
export async function getSupabase() {
  if (!url || !chiave) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } });
}
