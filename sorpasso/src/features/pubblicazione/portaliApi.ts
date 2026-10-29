/**
 * Dati del modulo Pubblicazione multi-portale (vedi migrazione 20261031100000_pubblicazione_portali.sql).
 * Le operazioni verso i portali le esegue la coda sync_jobs: qui si accodano e si legge lo stato.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import type { ControlloQualita, OrganizationPortal, Portal, ReportPortale, SyncJob, VehicleListing } from "@/types/db";

export const qkPortali = {
  radice: ["portali"] as const,
  catalogo: ["portali", "catalogo"] as const,
  org: ["portali", "org"] as const,
  annunci: (vehicleId: string) => ["portali", "annunci", vehicleId] as const,
  coda: (vehicleId: string) => ["portali", "coda", vehicleId] as const,
  qualita: (vehicleId: string) => ["portali", "qualita", vehicleId] as const,
};

export type PortaleOrg = OrganizationPortal & { portals: Portal };

export function useCatalogoPortali() {
  return useQuery({
    queryKey: qkPortali.catalogo,
    staleTime: 60 * 60_000,
    queryFn: async () => ok(await supabase.from("portals").select("*").order("ordine")) as Portal[],
  });
}

/** Portali della concessionaria (li vedono solo titolare e responsabile: RLS). */
export function usePortaliOrg(abilitato = true) {
  return useQuery({
    queryKey: qkPortali.org,
    enabled: abilitato,
    queryFn: async () =>
      ok(await supabase.from("organization_portals").select("*, portals(*)")) as unknown as PortaleOrg[],
    select: (righe) => [...righe].sort((a, b) => a.portals.ordine - b.portals.ordine),
  });
}

/** Annunci dell'auto. Si aggiorna da solo finché ci sono operazioni in corso. */
export function useAnnunciVeicolo(vehicleId: string, inCorso: boolean) {
  return useQuery({
    queryKey: qkPortali.annunci(vehicleId),
    refetchInterval: inCorso ? 4000 : 60_000,
    queryFn: async () =>
      ok(await supabase.from("vehicle_listings").select("*").eq("vehicle_id", vehicleId)) as VehicleListing[],
  });
}

/** Operazioni in coda o in corso per gli annunci dell'auto (solo manager: RLS). */
export function useCodaVeicolo(vehicleId: string, listingIds: string[], abilitato: boolean) {
  return useQuery({
    queryKey: [...qkPortali.coda(vehicleId), listingIds],
    enabled: abilitato && listingIds.length > 0,
    refetchInterval: (q) => ((q.state.data as SyncJob[] | undefined)?.length ? 4000 : 30_000),
    queryFn: async () =>
      ok(
        await supabase.from("sync_jobs").select("*").in("listing_id", listingIds).in("stato", ["in_coda", "in_corso"]),
      ) as SyncJob[],
  });
}

export function useControlloQualita(vehicleId: string, abilitato: boolean) {
  return useQuery({
    queryKey: qkPortali.qualita(vehicleId),
    enabled: abilitato,
    queryFn: async () => ok(await supabase.rpc("controllo_qualita_annuncio", { p_vehicle: vehicleId })) as ControlloQualita[],
  });
}

/** Chiede alla coda di partire subito, invece di aspettare il passaggio automatico di ogni minuto. */
export async function avviaSync() {
  await supabase.functions.invoke("sync-portali").catch(() => undefined);
}

function useInvalidaPortali() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qkPortali.radice }),
      qc.invalidateQueries({ queryKey: qk.veicoli }),
    ]);
}

export function usePubblicaOvunque() {
  const invalida = useInvalidaPortali();
  return useMutation({
    mutationFn: async (vehicleId: string) => {
      const esito = ok(await supabase.rpc("pubblica_ovunque", { p_vehicle: vehicleId })) as {
        portal_id: string;
        avviata: boolean;
        problemi: string[];
      }[];
      await invalida();
      void avviaSync().then(invalida);
      return esito;
    },
  });
}

/** Interruttore on/off di un portale per l'auto (crea l'annuncio se non c'è). */
export function useInterruttoreAnnuncio() {
  const invalida = useInvalidaPortali();
  return useMutation({
    mutationFn: async ({ vehicleId, portalId, attivo, esistente }: { vehicleId: string; portalId: string; attivo: boolean; esistente?: VehicleListing }) => {
      if (esistente) ok(await supabase.from("vehicle_listings").update({ attivo }).eq("id", esistente.id));
      else ok(await supabase.from("vehicle_listings").insert({ vehicle_id: vehicleId, portal_id: portalId, attivo }));
      await invalida();
      void avviaSync().then(invalida);
    },
  });
}

export function usePrezzoPortale() {
  const invalida = useInvalidaPortali();
  return useMutation({
    mutationFn: async ({ listingId, prezzo }: { listingId: string; prezzo: number | null }) => {
      ok(await supabase.from("vehicle_listings").update({ prezzo_portale: prezzo }).eq("id", listingId));
      await invalida();
      void avviaSync().then(invalida);
    },
  });
}

/** "Riprova" / "Aggiorna ora" su un portale. */
export function useRiprovaPortale() {
  const invalida = useInvalidaPortali();
  return useMutation({
    mutationFn: async ({ vehicleId, portalId }: { vehicleId: string; portalId: string }) => {
      ok(await supabase.rpc("accoda_sync_pubblico", { p_vehicle: vehicleId, p_portale: portalId }));
      await invalida();
      void avviaSync().then(invalida);
    },
  });
}

/** Modalità manuale: l'utente conferma di aver fatto l'azione sul portale. */
export function useConfermaManuale() {
  const invalida = useInvalidaPortali();
  return useMutation({
    mutationFn: async ({ listingId, url }: { listingId: string; url?: string }) => {
      ok(await supabase.rpc("conferma_azione_manuale", { p_listing: listingId, p_url: url?.trim() || null }));
      await invalida();
    },
  });
}

/* ---------- Impostazioni ---------- */

export function useAggiornaPortaleOrg() {
  const invalida = useInvalidaPortali();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Pick<OrganizationPortal, "attivo" | "modalita" | "costo_mensile" | "config">> & { id: string }) => {
      ok(await supabase.from("organization_portals").update(patch).eq("id", id));
      await invalida();
    },
  });
}

export function useSalvaCredenziali() {
  const invalida = useInvalidaPortali();
  return useMutation({
    mutationFn: async ({ portalId, credenziali }: { portalId: string; credenziali: string }) => {
      ok(await supabase.rpc("salva_credenziali_portale", { p_portale: portalId, p_credenziali: credenziali }));
      await invalida();
    },
  });
}

/** Stato del flag API di un connettore (GET pubblico della Edge Function portale-<id>). */
export function useApiAttiva(portalId: string, abilitato: boolean) {
  return useQuery({
    queryKey: ["portali", "api", portalId],
    enabled: abilitato,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ api_attiva: boolean }>(`portale-${portalId}`, { method: "GET" });
      if (error) return false;
      return !!data?.api_attiva;
    },
  });
}

/* ---------- Report ---------- */

export function useReportPortali(da: string, a: string) {
  return useQuery({
    queryKey: [...qk.report, "portali", da, a],
    queryFn: async () => ok(await supabase.rpc("report_portali", { p_da: da, p_a: a })) as ReportPortale[],
  });
}

/** Indirizzi da dare al portale (feed) o da configurare per ricevere i lead (webhook). */
const base = () => `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1`;
export const urlFeed = (token: string, formato: "xml" | "csv") => `${base()}/portale-feed?t=${token}${formato === "csv" ? "&formato=csv" : ""}`;
export const urlWebhookLead = (token: string) => `${base()}/lead-da-portale?t=${token}`;
