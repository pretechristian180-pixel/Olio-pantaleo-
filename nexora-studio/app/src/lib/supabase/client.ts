import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

/** Client Supabase per i Client Component (sessione dell'utente, soggetto a RLS). */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}
