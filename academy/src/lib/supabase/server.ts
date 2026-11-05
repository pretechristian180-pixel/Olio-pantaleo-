import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabasePublic } from "@/lib/env";
import { cookieOptionsFor } from "./cookie-domain";

/** Client per Server Components, Server Actions e Route Handlers: agisce come l'utente (RLS attiva). */
export async function createClient() {
  const { url, key } = requireSupabasePublic();
  const cookieStore = await cookies();
  const h = await headers();

  return createServerClient(url, key, {
    cookieOptions: cookieOptionsFor(h.get("x-forwarded-host") ?? h.get("host")),
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
