import { createClient } from "@supabase/supabase-js";

// Solo URL e chiave pubblica (anon): tutte le chiavi Stripe / Fatture in Cloud restano nei secrets delle Edge Functions.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chiave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurato = !!url && !!chiave;
export const supabase = createClient(url ?? "http://localhost", chiave ?? "manca");

/** Chiama una Edge Function con il token dell'amministratore collegato. */
export async function funzione<T = Record<string, unknown>>(nome: string, corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nome, { body: corpo });
  if (error) {
    // il messaggio leggibile è nel corpo della risposta
    const ctx = (error as { context?: Response }).context;
    const dettaglio = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(dettaglio?.error ?? error.message);
  }
  return data as T;
}

export const admin = <T = Record<string, unknown>>(azione: string, extra: Record<string, unknown> = {}) =>
  funzione<T>("billing-admin", { azione, ...extra });
