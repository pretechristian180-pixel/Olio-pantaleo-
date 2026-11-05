import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@nexora/shared";

import { publicEnv } from "@/lib/env";

/** Client Supabase per i Client Component (sessione dell'utente, soggetto a RLS). */
export function createClient() {
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}
