import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabasePublic } from "@/lib/env";

/** Client per Server Components, Server Actions e Route Handlers: agisce come l'utente (RLS attiva). */
export async function createClient() {
  const { url, key } = requireSupabasePublic();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: il middleware aggiorna già la sessione.
        }
      },
    },
  });
}
