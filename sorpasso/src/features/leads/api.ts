/**
 * Accesso ai dati dei lead. Usato da Lead, Oggi, Clienti, Agenda.
 * Ogni mutation invalida le chiavi collegate così tutte le viste restano allineate.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import type { Activity, Contact, FonteLead, Lead, LeadView, Quote, StatoLead, TipoAttivita } from "@/types/db";

export interface FiltriLead {
  fonte?: FonteLead | "";
  assegnato_a?: string;
  stato?: StatoLead | "";
  /** Data ISO minima di creazione. */
  da?: string;
  a?: string;
  cerca?: string;
}

export function useLeads(filtri: FiltriLead = {}) {
  return useQuery({
    queryKey: [...qk.lead, "elenco", filtri],
    queryFn: async () => {
      let q = supabase.from("leads_view").select("*").order("created_at", { ascending: false }).limit(1000);
      if (filtri.fonte) q = q.eq("fonte", filtri.fonte);
      if (filtri.assegnato_a) q = filtri.assegnato_a === "nessuno" ? q.is("assegnato_a", null) : q.eq("assegnato_a", filtri.assegnato_a);
      if (filtri.stato) q = q.eq("stato", filtri.stato);
      if (filtri.da) q = q.gte("created_at", filtri.da);
      if (filtri.a) q = q.lt("created_at", filtri.a);
      if (filtri.cerca?.trim()) {
        const t = filtri.cerca.trim().replace(/[%,()]/g, " ");
        q = q.or(`contatto_nome.ilike.%${t}%,contatto_cognome.ilike.%${t}%,contatto_telefono.ilike.%${t}%,veicolo_modello.ilike.%${t}%,marca_interesse.ilike.%${t}%`);
      }
      return ok(await q) as LeadView[];
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.lead, "dettaglio", id],
    enabled: !!id,
    queryFn: async () => ok(await supabase.from("leads_view").select("*").eq("id", id!).single()) as LeadView,
  });
}

export function useAttivita(leadId: string | undefined) {
  return useQuery({
    queryKey: [...qk.lead, "attivita", leadId],
    enabled: !!leadId,
    queryFn: async () =>
      ok(await supabase.from("activities").select("*").eq("lead_id", leadId!).order("created_at", { ascending: false })) as Activity[],
  });
}

export function usePreventiviLead(leadId: string | undefined) {
  return useQuery({
    queryKey: [...qk.lead, "preventivi", leadId],
    enabled: !!leadId,
    queryFn: async () =>
      ok(await supabase.from("quotes").select("*").eq("lead_id", leadId!).order("created_at", { ascending: false })) as Quote[],
  });
}

/** Invalida tutto ciò che dipende dai lead (liste, dashboard, clienti, report). */
export function useInvalidaLead() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.lead }),
      qc.invalidateQueries({ queryKey: qk.oggi }),
      qc.invalidateQueries({ queryKey: qk.contatti }),
      qc.invalidateQueries({ queryKey: qk.report }),
      qc.invalidateQueries({ queryKey: qk.veicoli }),
    ]);
}

export interface NuovoLeadInput {
  contatto: { id?: string; nome: string; cognome: string; telefono: string | null; email: string | null; consenso_privacy: boolean };
  lead: Partial<Pick<Lead, "fonte" | "vehicle_id" | "richiesta" | "assegnato_a" | "marca_interesse" | "modello_interesse" | "budget" | "prossima_azione_at" | "prossima_azione_nota">>;
}

export function useCreaLead() {
  const invalida = useInvalidaLead();
  return useMutation({
    mutationFn: async ({ contatto, lead }: NuovoLeadInput) => {
      let contactId = contatto.id;
      if (!contactId) {
        const { id: _ignora, ...nuovo } = contatto;
        const c = ok(
          await supabase
            .from("contacts")
            .insert({ ...nuovo, fonte: lead.fonte ?? null })
            .select("id")
            .single(),
        );
        contactId = c.id;
      }
      return ok(await supabase.from("leads").insert({ ...lead, contact_id: contactId }).select("id").single()) as { id: string };
    },
    onSuccess: () => invalida(),
  });
}

export function useAggiornaLead() {
  const invalida = useInvalidaLead();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Lead> & { id: string }) =>
      ok(await supabase.from("leads").update(patch).eq("id", id).select("id").single()),
    onSuccess: () => invalida(),
  });
}

export function useCambiaStato() {
  const invalida = useInvalidaLead();
  return useMutation({
    mutationFn: async ({ id, stato, motivo_perso }: { id: string; stato: StatoLead; motivo_perso?: string }) =>
      ok(
        await supabase
          .from("leads")
          .update({ stato, ...(stato === "perso" ? { motivo_perso, prossima_azione_at: null, prossima_azione_nota: null } : {}) })
          .eq("id", id)
          .select("id")
          .single(),
      ),
    onSuccess: () => invalida(),
  });
}

export function useAggiungiAttivita() {
  const invalida = useInvalidaLead();
  return useMutation({
    mutationFn: async (a: { lead_id: string; tipo: Exclude<TipoAttivita, "cambio_stato">; contenuto: string }) =>
      ok(await supabase.from("activities").insert(a)),
    onSuccess: () => invalida(),
  });
}

/** Cerca un contatto per telefono (per evitare doppioni quando si crea un lead). */
export async function cercaContattoPerTelefono(tel: string): Promise<Pick<Contact, "id" | "nome" | "cognome" | "telefono">[]> {
  const cifre = tel.replace(/\D/g, "").slice(-9);
  if (cifre.length < 6) return [];
  const { data } = await supabase.from("contacts").select("id, nome, cognome, telefono").ilike("telefono", `%${cifre.slice(-6)}%`).limit(5);
  return (data ?? []).filter((c) => (c.telefono ?? "").replace(/\D/g, "").endsWith(cifre));
}
