import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ErroreLeggibile } from "@/lib/errors";

export type RichiestaAI =
  | { azione: "descrizione_annuncio"; vehicle_id: string }
  | { azione: "suggerisci_risposta"; lead_id: string; canale: "whatsapp" | "email" }
  | { azione: "riassunto_lead"; lead_id: string };

/** Chiama la Edge Function "ai". La chiave del modello resta sul server. */
export async function chiediAI(richiesta: RichiestaAI): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ testo: string }>("ai", { body: richiesta });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new ErroreLeggibile(body?.error ?? "Il servizio AI non è disponibile in questo momento.");
    }
    throw new ErroreLeggibile("Il servizio AI non è raggiungibile. Controlla la connessione.");
  }
  return data!.testo;
}
