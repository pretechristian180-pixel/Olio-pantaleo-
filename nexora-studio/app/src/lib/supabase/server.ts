import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { Database } from "@nexora/shared";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";

/** Client Supabase per Server Component, Server Function e Route Handler (soggetto a RLS). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: i cookie li aggiorna il proxy.
        }
      },
    },
  });
}
