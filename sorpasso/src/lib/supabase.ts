import { createClient } from "@supabase/supabase-js";
import { DEMO, DEMO_URL } from "@/demo/config";
import { archivioDemo } from "@/demo/memoria";

const url = DEMO ? DEMO_URL : (import.meta.env.VITE_SUPABASE_URL as string | undefined);
const anonKey = DEMO ? "demo" : (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

/** true se le variabili d'ambiente non sono compilate: l'app mostra una pagina di configurazione. */
export const supabaseNonConfigurato = !url || !anonKey;

export const supabase = createClient(url ?? "http://localhost:54321", anonKey ?? "chiave-mancante", {
  auth: DEMO
    ? { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage: archivioDemo("sb-demo-auth-token") }
    : { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const BUCKET_FOTO = "vehicle-photos";
export const BUCKET_DOCUMENTI = "documents";
