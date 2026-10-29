/**
 * Accesso ai dati dello stock: veicoli, foto, storico prezzi, costi (solo manager),
 * clienti compatibili e lead interessati.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, BUCKET_FOTO } from "@/lib/supabase";
import { ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import { comprimiImmagine, percorsoFile } from "@/lib/storage";
import type {
  ClienteCompatibile,
  LeadView,
  StatoVeicolo,
  Vehicle,
  VehicleCost,
  VehiclePhoto,
  VehiclePriceHistory,
  VehicleView,
} from "@/types/db";

export function useVeicoli() {
  return useQuery({
    queryKey: [...qk.veicoli, "elenco"],
    queryFn: async () =>
      ok(await supabase.from("vehicles_view").select("*").order("data_ingresso", { ascending: true }).limit(2000)) as VehicleView[],
  });
}

export function useVeicolo(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.veicoli, "dettaglio", id],
    enabled: !!id,
    queryFn: async () => ok(await supabase.from("vehicles_view").select("*").eq("id", id!).single()) as VehicleView,
  });
}

export function useFotoVeicolo(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.veicoli, "foto", id],
    enabled: !!id,
    queryFn: async () =>
      ok(
        await supabase.from("vehicle_photos").select("*").eq("vehicle_id", id!).order("ordine").order("created_at"),
      ) as VehiclePhoto[],
  });
}

export function useStoricoPrezzi(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.veicoli, "prezzi", id],
    enabled: !!id,
    queryFn: async () =>
      ok(
        await supabase.from("vehicle_price_history").select("*").eq("vehicle_id", id!).order("created_at", { ascending: false }),
      ) as VehiclePriceHistory[],
  });
}

/** Prezzo di acquisto: la tabella è leggibile solo da titolare e responsabile vendite. */
export function useCostoVeicolo(id: string | undefined, abilitato: boolean) {
  return useQuery({
    queryKey: [...qk.veicoli, "costo", id],
    enabled: !!id && abilitato,
    queryFn: async () =>
      ok(await supabase.from("vehicle_costs").select("*").eq("vehicle_id", id!).maybeSingle()) as VehicleCost | null,
  });
}

export function useClientiCompatibili(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.veicoli, "compatibili", id],
    enabled: !!id,
    queryFn: async () => ok(await supabase.rpc("clienti_compatibili", { p_vehicle: id! })) as ClienteCompatibile[],
  });
}

export function useLeadInteressati(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.lead, "veicolo", id],
    enabled: !!id,
    queryFn: async () =>
      ok(await supabase.from("leads_view").select("*").eq("vehicle_id", id!).order("created_at", { ascending: false })) as LeadView[],
  });
}

function useInvalidaVeicoli() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.veicoli }),
      qc.invalidateQueries({ queryKey: qk.veicoliSelezionabili }),
      qc.invalidateQueries({ queryKey: qk.oggi }),
    ]);
}

export type VeicoloInput = Omit<Vehicle, "id" | "organization_id" | "created_at" | "updated_at" | "data_uscita" | "descrizione"> & {
  descrizione?: string | null;
};

export function useSalvaVeicolo() {
  const invalida = useInvalidaVeicoli();
  return useMutation({
    mutationFn: async ({
      id,
      veicolo,
      prezzoAcquisto,
    }: {
      id?: string;
      veicolo: VeicoloInput;
      /** undefined = non toccare (utente non manager). */
      prezzoAcquisto?: number | null;
    }) => {
      const salvato = id
        ? ok(await supabase.from("vehicles").update(veicolo).eq("id", id).select("id").single())
        : ok(await supabase.from("vehicles").insert(veicolo).select("id").single());
      if (prezzoAcquisto !== undefined) {
        ok(
          await supabase
            .from("vehicle_costs")
            .upsert({ vehicle_id: salvato.id, prezzo_acquisto: prezzoAcquisto }, { onConflict: "vehicle_id" }),
        );
      }
      return salvato as { id: string };
    },
    onSuccess: () => invalida(),
  });
}

export function useAggiornaVeicolo() {
  const invalida = useInvalidaVeicoli();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; stato?: StatoVeicolo; descrizione?: string | null }) =>
      ok(await supabase.from("vehicles").update(patch).eq("id", id).select("id").single()),
    onSuccess: () => invalida(),
  });
}

export function useCaricaFoto() {
  const invalida = useInvalidaVeicoli();
  return useMutation({
    mutationFn: async ({ orgId, vehicleId, files, ordineIniziale }: { orgId: string; vehicleId: string; files: File[]; ordineIniziale: number }) => {
      let ordine = ordineIniziale;
      for (const file of files) {
        const blob = await comprimiImmagine(file);
        const path = percorsoFile(orgId, `veicoli/${vehicleId}`, blob.type === "image/jpeg" ? "foto.jpg" : file.name);
        const up = await supabase.storage.from(BUCKET_FOTO).upload(path, blob, {
          contentType: blob.type || file.type,
          upsert: false,
        });
        if (up.error) throw up.error;
        const ins = await supabase.from("vehicle_photos").insert({ vehicle_id: vehicleId, storage_path: path, ordine: ordine++ });
        if (ins.error) {
          await supabase.storage.from(BUCKET_FOTO).remove([path]);
          throw ins.error;
        }
      }
    },
    onSuccess: () => invalida(),
  });
}

export function useEliminaFoto() {
  const invalida = useInvalidaVeicoli();
  return useMutation({
    mutationFn: async (foto: VehiclePhoto) => {
      ok(await supabase.from("vehicle_photos").delete().eq("id", foto.id));
      await supabase.storage.from(BUCKET_FOTO).remove([foto.storage_path]);
    },
    onSuccess: () => invalida(),
  });
}

/** Mette una foto come copertina (ordine 0) e rinumera le altre. */
export function useImpostaCopertina() {
  const invalida = useInvalidaVeicoli();
  return useMutation({
    mutationFn: async ({ foto, tutte }: { foto: VehiclePhoto; tutte: VehiclePhoto[] }) => {
      const ordinate = [foto, ...tutte.filter((f) => f.id !== foto.id)];
      for (let i = 0; i < ordinate.length; i++) {
        if (ordinate[i]!.ordine !== i) {
          ok(await supabase.from("vehicle_photos").update({ ordine: i }).eq("id", ordinate[i]!.id));
        }
      }
    },
    onSuccess: () => invalida(),
  });
}
