import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true se le variabili d'ambiente non sono compilate: l'app mostra una pagina di configurazione. */
export const supabaseNonConfigurato = !url || !anonKey;

export const supabase = createClient(url ?? "http://localhost:54321", anonKey ?? "chiave-mancante", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const BUCKET_FOTO = "vehicle-photos";
export const BUCKET_DOCUMENTI = "documents";
