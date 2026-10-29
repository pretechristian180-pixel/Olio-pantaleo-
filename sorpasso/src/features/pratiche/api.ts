/** Pratiche (vendite chiuse): elenco, dettaglio, checklist, consegna. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import { CHECKLIST } from "@/lib/labels";
import type { ChecklistVoce, Deal, StatoVoce } from "@/types/db";

export interface PraticaEstesa extends Deal {
  contacts: { id: string; nome: string; cognome: string; telefono: string | null; email: string | null } | null;
  vehicles: { id: string; marca: string; modello: string; versione: string | null; targa: string | null; anno: number | null } | null;
  profiles: { user_id: string; nome: string } | null;
}

const SELECT =
  "*, contacts(id, nome, cognome, telefono, email), vehicles(id, marca, modello, versione, targa, anno), profiles!deals_venditore_id_organization_id_fkey(user_id, nome)";

export function usePratiche() {
  return useQuery({
    queryKey: [...qk.pratiche, "elenco"],
    queryFn: async () =>
      ok(await supabase.from("deals").select(SELECT).order("data_vendita", { ascending: false }).limit(1000)) as unknown as PraticaEstesa[],
  });
}

export function usePratica(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.pratiche, "dettaglio", id],
    enabled: !!id,
    queryFn: async () => ok(await supabase.from("deals").select(SELECT).eq("id", id!).single()) as unknown as PraticaEstesa,
  });
}

/** Prima voce della checklist non ancora fatta (in ordine), o null se completa. */
export function prossimaVoce(d: Pick<Deal, "checklist">) {
  return CHECKLIST.find((c) => d.checklist?.[c.voce] !== "fatto") ?? null;
}

function useInvalida() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.pratiche }),
      qc.invalidateQueries({ queryKey: qk.oggi }),
      qc.invalidateQueries({ queryKey: qk.contatti }),
    ]);
}

export function useAggiornaVoce() {
  const qc = useQueryClient();
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async ({ id, voce, stato }: { id: string; voce: ChecklistVoce; stato: StatoVoce }) => {
      // Rilegge la checklist aggiornata e cambia solo la voce: non sovrascrive modifiche di colleghi.
      const attuale = ok(await supabase.from("deals").select("checklist").eq("id", id).single()) as Pick<Deal, "checklist">;
      return ok(
        await supabase
          .from("deals")
          .update({ checklist: { ...attuale.checklist, [voce]: stato } })
          .eq("id", id)
          .select("checklist, avanzamento")
          .single(),
      );
    },
    // Aggiornamento immediato a schermo, poi conferma dal server.
    onMutate: async ({ id, voce, stato }) => {
      const chiave = [...qk.pratiche, "dettaglio", id];
      await qc.cancelQueries({ queryKey: chiave });
      const prima = qc.getQueryData<PraticaEstesa>(chiave);
      if (prima) {
        const checklist = { ...prima.checklist, [voce]: stato };
        const fatte = CHECKLIST.filter((c) => checklist[c.voce] === "fatto").length;
        qc.setQueryData<PraticaEstesa>(chiave, { ...prima, checklist, avanzamento: Math.floor((fatte * 100) / 7) });
      }
      return { prima, chiave };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prima) qc.setQueryData(ctx.chiave, ctx.prima);
    },
    onSettled: () => invalida(),
  });
}

export function useAggiornaPratica() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<Deal, "data_consegna" | "note">>) =>
      ok(await supabase.from("deals").update(patch).eq("id", id).select("id").single()),
    onSuccess: () => invalida(),
  });
}
