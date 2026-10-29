import { z } from "zod";
import { PIVA, telefonoOpzionale, testoObbligatorio, vuotoANull } from "@/lib/schemas";
import { supabase } from "@/lib/supabase";
import { ok } from "@/lib/errors";

/** Campi comuni a registrazione e completamento profilo. */
export const campiAzienda = {
  azienda: testoObbligatorio("il nome della concessionaria"),
  piva: z
    .string()
    .trim()
    .refine((v) => v === "" || PIVA.test(v), "La partita IVA ha 11 cifre"),
  nome: testoObbligatorio("il tuo nome"),
  telefono: telefonoOpzionale,
};

export async function creaOrganizzazione(v: { azienda: string; nome: string; piva: string; telefono: string }) {
  return ok(
    await supabase.rpc("crea_organizzazione", {
      p_nome_azienda: v.azienda,
      p_nome_utente: v.nome,
      p_piva: vuotoANull(v.piva),
      p_telefono: vuotoANull(v.telefono),
    }),
  );
}
