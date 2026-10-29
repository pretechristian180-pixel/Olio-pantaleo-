/** Validazione del modulo demo (caricata solo all'invio). */
import { z } from "zod";
import { FASCE_LEAD } from "@/contenuti";

export const schemaDemo = z.object({
  nome: z.string().trim().min(2, "Scrivi nome e cognome").max(80, "Massimo 80 caratteri"),
  concessionaria: z.string().trim().min(2, "Scrivi il nome della concessionaria").max(120, "Massimo 120 caratteri"),
  citta: z.string().trim().min(2, "Scrivi la città").max(80, "Massimo 80 caratteri"),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[\d\s./-]{8,20}$/, "Numero di telefono non valido"),
  venditori: z.coerce
    .number({ message: "Indica quanti venditori avete" })
    .int("Usa un numero intero")
    .min(1, "Almeno 1 venditore")
    .max(500, "Numero troppo alto"),
  lead_mese: z.enum(FASCE_LEAD, { message: "Scegli una fascia" }),
  consenso_privacy: z.literal(true, { message: "Serve il consenso per poterti ricontattare" }),
});

