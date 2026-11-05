import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@nexora/shared";

import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Client con service role: bypassa la RLS. Solo codice server, solo DOPO aver verificato
 * l'utente e la sua appartenenza all'azienda. Mai in componenti client.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY mancante");
  client ??= createClient<Database>(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
