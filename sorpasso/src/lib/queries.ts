/**
 * Query condivise tra più sezioni (colleghi, notifiche, template, auto selezionabili).
 * Le query specifiche di una sezione stanno in features/<sezione>/api.ts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ok } from "@/lib/errors";
import { useAuth } from "@/lib/auth";
import type { CanaleMessaggio, MessageTemplate, Notification, Profile, VehicleView } from "@/types/db";

/** Chiavi di cache: invalidare la radice aggiorna tutte le viste collegate. */
export const qk = {
  colleghi: ["colleghi"] as const,
  notifiche: ["notifiche"] as const,
  templates: ["templates"] as const,
  veicoliSelezionabili: ["veicoli", "selezionabili"] as const,
  lead: ["lead"] as const,
  veicoli: ["veicoli"] as const,
  contatti: ["contatti"] as const,
  appuntamenti: ["appuntamenti"] as const,
  pratiche: ["pratiche"] as const,
  report: ["report"] as const,
  oggi: ["oggi"] as const,
};

export function useColleghi() {
  return useQuery({
    queryKey: qk.colleghi,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      ok(await supabase.from("profiles").select("*").order("nome")) as Profile[],
  });
}

/** Chi può avere lead e appuntamenti assegnati. */
export function useVenditori() {
  const q = useColleghi();
  return {
    ...q,
    data: q.data?.filter((p) => p.attivo && (p.ruolo === "venditore" || p.ruolo === "responsabile_vendite" || p.ruolo === "titolare")),
  };
}

export function useNotifiche() {
  const { profilo } = useAuth();
  return useQuery({
    queryKey: qk.notifiche,
    enabled: !!profilo,
    refetchInterval: 60_000,
    queryFn: async () =>
      ok(
        await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30),
      ) as Notification[],
  });
}

export function useSegnaNotificheLette() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => ok(await supabase.rpc("segna_notifiche_lette")),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifiche }),
  });
}

export function useTemplates(canale?: CanaleMessaggio) {
  const q = useQuery({
    queryKey: qk.templates,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      ok(await supabase.from("message_templates").select("*").order("canale").order("nome")) as MessageTemplate[],
  });
  return { ...q, data: canale ? q.data?.filter((t) => t.canale === canale) : q.data };
}

/** Auto non vendute, per i menu a tendina (lead, appuntamenti, preventivi). */
export function useVeicoliSelezionabili() {
  return useQuery({
    queryKey: qk.veicoliSelezionabili,
    staleTime: 60_000,
    queryFn: async () =>
      ok(
        await supabase
          .from("vehicles_view")
          .select("id, marca, modello, versione, anno, km, targa, prezzo_vendita, stato")
          .neq("stato", "venduto")
          .order("marca")
          .order("modello"),
      ) as Pick<VehicleView, "id" | "marca" | "modello" | "versione" | "anno" | "km" | "targa" | "prezzo_vendita" | "stato">[],
  });
}

export const etichettaVeicolo = (v: { marca: string; modello: string; versione?: string | null; targa?: string | null; anno?: number | null }) =>
  [`${v.marca} ${v.modello}`, v.versione, v.anno, v.targa].filter(Boolean).join(" · ");
