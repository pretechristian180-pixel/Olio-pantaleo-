import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error("Mancano VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY: copia .env.example in .env.local");
}

/**
 * Il link di invito o di recupero password arriva con "type=invite" o "type=recovery"
 * nell'indirizzo. Lo leggiamo prima che il client Supabase lo consumi,
 * così sappiamo di dover mostrare "Imposta la password".
 */
const hash = typeof window !== "undefined" ? window.location.hash : "";
export const authLinkType: "invite" | "recovery" | null = /type=invite/.test(hash)
  ? "invite"
  : /type=recovery/.test(hash)
    ? "recovery"
    : null;

export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const PHOTO_BUCKET = "property-photos";
export const LOGO_BUCKET = "agency-logos";
