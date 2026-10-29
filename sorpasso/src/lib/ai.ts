import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ErroreLeggibile } from "@/lib/errors";

export type RichiestaAI =
  | { azione: "descrizione_annuncio"; vehicle_id: string }
  | { azione: "suggerisci_risposta"; lead_id: string; canale: "whatsapp" | "email" }
  | { azione: "riassunto_lead"; lead_id: string };

/** Chiama la Edge Function "ai". La chiave del modello resta sul server. */
export async function chiediAI(richiesta: RichiestaAI): Promise<string> {
  return (await invoca(richiesta)).testo;
}

/** Descrizione annuncio: versione completa (portali) e breve (social/WhatsApp). */
export async function generaDescrizioni(vehicleId: string): Promise<{ completa: string; breve: string }> {
  const r = await invoca({ azione: "descrizione_annuncio", vehicle_id: vehicleId });
  return { completa: r.testo, breve: r.breve ?? "" };
}

async function invoca(richiesta: RichiestaAI): Promise<{ testo: string; breve?: string }> {
  const { data, error } = await supabase.functions.invoke<{ testo: string; breve?: string }>("ai", { body: richiesta });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new ErroreLeggibile(body?.error ?? "Il servizio AI non è disponibile in questo momento.");
    }
    throw new ErroreLeggibile("Il servizio AI non è raggiungibile. Controlla la connessione.");
  }
  return data!;
}
