import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type Plan = {
  codice: string;
  nome: string;
  descrizione: string | null;
  prezzo_mese_cents: number;
  prezzo_anno_cents: number | null;
  max_ore_video: number | null;
  max_studenti_attivi: number | null;
  max_staff: number | null;
  dominio_personalizzato: boolean;
  senza_marchio_nexora: boolean;
  abbonamenti_studenti: boolean;
};

export const getPlans = cache(async (): Promise<Plan[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_plans")
    .select(
      "codice, nome, descrizione, prezzo_mese_cents, prezzo_anno_cents, max_ore_video, max_studenti_attivi, max_staff, dominio_personalizzato, senza_marchio_nexora, abbonamenti_studenti",
    )
    .eq("attivo", true)
    .order("ordine");
  if (error) throw new Error(`Piani non disponibili: ${error.message}`);
  return (data ?? []) as Plan[];
});

/** Cosa include un piano, in parole semplici. */
export function planFeatures(p: Plan) {
  const n = (v: number | null, one: string, many: string) =>
    v === null ? `${many} illimitati` : `${v.toLocaleString("it-IT")} ${v === 1 ? one : many}`;
  return [
    `${p.max_ore_video === null ? "Ore di video illimitate" : `Fino a ${p.max_ore_video} ore di video`}`,
    `${n(p.max_studenti_attivi, "studente attivo", "studenti attivi")} al mese`,
    `${n(p.max_staff, "persona", "persone")} del team nel pannello`,
    "Vendita dei corsi con il tuo Stripe, 0% di commissione",
    "Il tuo logo e i tuoi colori",
    p.dominio_personalizzato
      ? "Il tuo dominio (es. academy.tuaazienda.it)"
      : "Indirizzo tuonome.academy.nexoragruppodigitale.it",
    ...(p.senza_marchio_nexora ? ["Senza la scritta «Creato con Nexora Academy»"] : []),
    ...(p.abbonamenti_studenti
      ? ["Abbonamenti mensili per i tuoi studenti", "Accessi aziendali per i team"]
      : []),
  ];
}
