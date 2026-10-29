import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import type { Appointment } from "@/types/db";

/** Appuntamento con i riferimenti per mostrarlo (cliente, auto). */
export interface AppuntamentoEsteso extends Appointment {
  contacts: { id: string; nome: string; cognome: string; telefono: string | null } | null;
  vehicles: { id: string; marca: string; modello: string; targa: string | null } | null;
  leads: { id: string; contacts: { id: string; nome: string; cognome: string; telefono: string | null } | null } | null;
}

const SELECT = "*, contacts(id, nome, cognome, telefono), vehicles(id, marca, modello, targa), leads(id, contacts(id, nome, cognome, telefono))";

/** Nome del cliente dell'appuntamento (dal contatto o dal lead collegato). */
export const clienteAppuntamento = (a: AppuntamentoEsteso) => {
  const c = a.contacts ?? a.leads?.contacts ?? null;
  return c ? `${c.nome} ${c.cognome}`.trim() : null;
};

export function useAppuntamenti(da: Date, a: Date, assegnatoA?: string) {
  return useQuery({
    queryKey: [...qk.appuntamenti, da.toISOString(), a.toISOString(), assegnatoA ?? "tutti"],
    queryFn: async () => {
      let q = supabase.from("appointments").select(SELECT).gte("inizio", da.toISOString()).lt("inizio", a.toISOString()).order("inizio");
      if (assegnatoA) q = q.eq("assegnato_a", assegnatoA);
      return ok(await q) as unknown as AppuntamentoEsteso[];
    },
  });
}

export function useAppuntamentiLead(leadId: string | undefined) {
  return useQuery({
    queryKey: [...qk.appuntamenti, "lead", leadId],
    enabled: !!leadId,
    queryFn: async () =>
      ok(await supabase.from("appointments").select(SELECT).eq("lead_id", leadId!).order("inizio", { ascending: false })) as unknown as AppuntamentoEsteso[],
  });
}

function useInvalida() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.appuntamenti }),
      qc.invalidateQueries({ queryKey: qk.oggi }),
      qc.invalidateQueries({ queryKey: qk.lead }),
    ]);
}

export type AppuntamentoInput = Pick<Appointment, "tipo" | "inizio" | "fine" | "note" | "lead_id" | "contact_id" | "vehicle_id" | "assegnato_a">;

export function useSalvaAppuntamento() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async ({ id, ...a }: Partial<Appointment> & { id?: string }) =>
      id
        ? ok(await supabase.from("appointments").update(a).eq("id", id).select("id").single())
        : ok(await supabase.from("appointments").insert(a).select("id").single()),
    onSuccess: () => invalida(),
  });
}

export function useEliminaAppuntamento() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async (id: string) => ok(await supabase.from("appointments").delete().eq("id", id)),
    onSuccess: () => invalida(),
  });
}
