/**
 * Assistente AI. La domanda va alla Edge Function "assistente", che legge i dati con la sessione
 * di chi chiede (vede solo ciò che vede nell'app) e risponde in italiano. La chiave AI resta sul server.
 */
import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  role: "utente" | "assistente";
  text: string;
}

export async function askAssistant(history: ChatMessage[]): Promise<{ answer: string; left: number | null }> {
  const { data, error } = await supabase.functions.invoke<{ risposta?: string; rimaste?: number; error?: string }>("assistente", {
    body: { messaggi: history.slice(-12).map((m) => ({ ruolo: m.role, testo: m.text })) },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === "function" ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null;
    throw new Error(msg ?? "L'assistente non ha risposto. Controlla la connessione e riprova.");
  }
  if (data?.error) throw new Error(data.error);
  return { answer: data?.risposta ?? "", left: data?.rimaste ?? null };
}
