"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublic } from "@/lib/env";

/** Client per il browser: usa solo la chiave pubblica, le RLS fanno il resto. */
export function createClient() {
  const { url, key } = requireSupabasePublic();
  return createBrowserClient(url, key);
}
