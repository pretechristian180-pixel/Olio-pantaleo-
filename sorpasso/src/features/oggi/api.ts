import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import { addDays, startOfDay, startOfMonth } from "@/lib/format";
import type { LeadView, ReportPeriodo, VehicleView } from "@/types/db";

/** Tutto ciò che serve alla schermata "Oggi", in parallelo. RLS limita il venditore ai suoi lead. */
export function useOggi() {
  return useQuery({
    queryKey: [...qk.oggi, "liste"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const fineGiornata = addDays(startOfDay(), 1).toISOString();
      const [daContattare, senzaAzione, followUp, ferme] = await Promise.all([
        supabase.from("leads_view").select("*").eq("stato", "nuovo").is("primo_contatto_at", null).order("created_at").limit(50),
        supabase.from("leads_view").select("*").eq("senza_prossima_azione", true).neq("stato", "nuovo").order("updated_at").limit(50),
        supabase
          .from("leads_view")
          .select("*")
          .not("stato", "in", "(nuovo,vinto,perso)")
          .lt("prossima_azione_at", fineGiornata)
          .order("prossima_azione_at")
          .limit(50),
        supabase.from("vehicles_view").select("*").eq("oltre_soglia", true).order("data_ingresso").limit(8),
      ]);
      return {
        daContattare: ok(daContattare) as LeadView[],
        senzaAzione: ok(senzaAzione) as LeadView[],
        followUp: ok(followUp) as LeadView[],
        ferme: ok(ferme) as VehicleView[],
      };
    },
  });
}

/** KPI del mese corrente (titolare e responsabile). */
export function useKpiMese(attivo: boolean) {
  return useQuery({
    queryKey: [...qk.report, "mese-corrente"],
    enabled: attivo,
    queryFn: async () =>
      ok(
        await supabase.rpc("report_periodo", {
          p_da: startOfMonth().toISOString(),
          p_a: addDays(startOfDay(), 1).toISOString(),
        }),
      ) as ReportPeriodo,
  });
}
