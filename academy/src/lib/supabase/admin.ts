import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublic } from "@/lib/env";
import { requireServerEnv } from "@/lib/env.server";

/**
 * Client con chiave segreta: SALTA le RLS.
 * Solo per webhook, cron e operazioni admin già autorizzate lato server.
 */
export function createAdminClient() {
  const { url } = requireSupabasePublic();
  return createClient(url, requireServerEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
