/**
 * Conto economico delle auto: costi, ricavi, categorie e numeri calcolati dal database
 * (vista vehicle_economics). Accesso consentito solo a titolare, responsabile vendite e
 * amministrazione: per gli altri ruoli RLS restituisce elenchi vuoti.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, BUCKET_DOCUMENTI } from "@/lib/supabase";
import { ErroreLeggibile, ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import { percorsoFile } from "@/lib/storage";
import type { CategoriaEconomica, Organization, RegimeIva, TipoVoceEconomica, VehicleCost, VehicleEconomics, VehicleRevenue } from "@/types/db";

export const qkEconomia = ["economia"] as const;
export const CATEGORIA_ACQUISTO = "Acquisto";
export const CATEGORIA_VENDITA = "Prezzo di vendita";
export const ALIQUOTE = [22, 10, 4, 0];

const FORMATI_FATTURA = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const DIMENSIONE_MAX = 15 * 1024 * 1024;

/** Invalida i numeri economici e le viste che ne dipendono (stock, schede). */
function useInvalida() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qkEconomia }),
      qc.invalidateQueries({ queryKey: qk.veicoli }),
      qc.invalidateQueries({ queryKey: qk.veicoliSelezionabili }),
    ]);
}

// ---------- Letture ----------

export function useEconomiaVeicolo(vehicleId: string | undefined) {
  return useQuery({
    queryKey: [...qkEconomia, "veicolo", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () =>
      ok(await supabase.from("vehicle_economics").select("*").eq("vehicle_id", vehicleId!).maybeSingle()) as VehicleEconomics | null,
  });
}

export function useEconomiaElenco() {
  return useQuery({
    queryKey: [...qkEconomia, "elenco"],
    queryFn: async () => ok(await supabase.from("vehicle_economics").select("*").limit(5000)) as VehicleEconomics[],
  });
}

export function useCosti(vehicleId: string | undefined) {
  return useQuery({
    queryKey: [...qkEconomia, "costi", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () =>
      ok(
        await supabase.from("vehicle_costs").select("*").eq("vehicle_id", vehicleId!).order("data").order("created_at"),
      ) as VehicleCost[],
  });
}

export function useRicavi(vehicleId: string | undefined) {
  return useQuery({
    queryKey: [...qkEconomia, "ricavi", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () =>
      ok(
        await supabase.from("vehicle_revenues").select("*").eq("vehicle_id", vehicleId!).order("data").order("created_at"),
      ) as VehicleRevenue[],
  });
}

export function useCategorie() {
  return useQuery({
    queryKey: [...qkEconomia, "categorie"],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      ok(await supabase.from("categorie_economiche").select("*").order("tipo").order("ordine").order("nome")) as CategoriaEconomica[],
  });
}

// ---------- Costi ----------

export interface CostoInput {
  id?: string;
  vehicle_id: string;
  data: string;
  categoria: string;
  descrizione: string | null;
  fornitore: string | null;
  importo: number;
  iva_aliquota: number;
  /** Nuova fattura da caricare (sostituisce quella esistente) */
  file?: File | null;
  /** Fattura attuale, per rimuoverla se viene sostituita */
  allegatoPrecedente?: string | null;
}

export function useSalvaCosto() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async ({ file, allegatoPrecedente, id, ...voce }: CostoInput & { orgId: string }) => {
      const { orgId, ...riga } = voce;
      let allegato_path: string | undefined;
      if (file) {
        if (!FORMATI_FATTURA.includes(file.type)) throw new ErroreLeggibile("La fattura deve essere un PDF o una foto (JPG, PNG, WebP).");
        if (file.size > DIMENSIONE_MAX) throw new ErroreLeggibile("Il file supera i 15 MB.");
        allegato_path = percorsoFile(orgId, `costi/${riga.vehicle_id}`, file.name);
        const { error } = await supabase.storage.from(BUCKET_DOCUMENTI).upload(allegato_path, file, { contentType: file.type });
        if (error) throw error;
      }
      const dati = { ...riga, ...(allegato_path ? { allegato_path } : {}) };
      const res = id
        ? await supabase.from("vehicle_costs").update(dati).eq("id", id).select("id").single()
        : await supabase.from("vehicle_costs").insert(dati).select("id").single();
      if (res.error) {
        // La voce non si è salvata: non lasciare file orfani
        if (allegato_path) await supabase.storage.from(BUCKET_DOCUMENTI).remove([allegato_path]);
        throw res.error;
      }
      if (allegato_path && allegatoPrecedente) await supabase.storage.from(BUCKET_DOCUMENTI).remove([allegatoPrecedente]);
      return res.data;
    },
    onSuccess: () => invalida(),
  });
}

export function useEliminaCosto() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async (c: Pick<VehicleCost, "id" | "allegato_path">) => {
      ok(await supabase.from("vehicle_costs").delete().eq("id", c.id));
      if (c.allegato_path) await supabase.storage.from(BUCKET_DOCUMENTI).remove([c.allegato_path]);
    },
    onSuccess: () => invalida(),
  });
}

// ---------- Ricavi ----------

export interface RicavoInput {
  id?: string;
  vehicle_id: string;
  data: string;
  categoria: string;
  descrizione: string | null;
  importo: number;
  iva_aliquota: number;
}

export function useSalvaRicavo() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async ({ id, ...riga }: RicavoInput) => {
      const res = id
        ? await supabase.from("vehicle_revenues").update(riga).eq("id", id).select("id").single()
        : await supabase.from("vehicle_revenues").insert(riga).select("id").single();
      if (res.error) {
        if ((res.error as { code?: string }).code === "23505") {
          throw new ErroreLeggibile("Il prezzo di vendita di quest'auto è già registrato: modifica quella voce.");
        }
        throw res.error;
      }
      return res.data;
    },
    onSuccess: () => invalida(),
  });
}

export function useEliminaRicavo() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async (id: string) => ok(await supabase.from("vehicle_revenues").delete().eq("id", id)),
    onSuccess: () => invalida(),
  });
}

// ---------- Auto (prezzo, sconto massimo, regime IVA: solo titolare/responsabile) ----------

export function useAggiornaVeicoloEconomia() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; regime_iva?: RegimeIva; sconto_max?: number | null; prezzo_vendita?: number | null }) =>
      ok(await supabase.from("vehicles").update(patch).eq("id", id).select("id").single()),
    onSuccess: () => invalida(),
  });
}

// ---------- Categorie e impostazioni ----------

export function useSalvaCategoria() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async (c: { id?: string; tipo?: TipoVoceEconomica; nome?: string; ordine?: number; attiva?: boolean }) => {
      const { id, ...dati } = c;
      const res = id
        ? await supabase.from("categorie_economiche").update(dati).eq("id", id).select("id").single()
        : await supabase.from("categorie_economiche").insert(dati).select("id").single();
      if (res.error) {
        if ((res.error as { code?: string }).code === "23505") throw new ErroreLeggibile("Esiste già una categoria con questo nome.");
        throw res.error;
      }
      return res.data;
    },
    onSuccess: () => invalida(),
  });
}

/** Scambia l'ordine di due categorie (frecce su/giù). */
export function useScambiaOrdine() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async ([a, b]: [CategoriaEconomica, CategoriaEconomica]) => {
      // Se hanno lo stesso ordine (es. appena create) usiamo le posizioni in elenco
      const oa = a.ordine === b.ordine ? b.ordine + 1 : b.ordine;
      ok(await supabase.from("categorie_economiche").update({ ordine: oa }).eq("id", a.id));
      ok(await supabase.from("categorie_economiche").update({ ordine: a.ordine }).eq("id", b.id));
    },
    onSuccess: () => invalida(),
  });
}

export function useAggiornaImpostazioniEconomia() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Pick<Organization, "id" | "costo_giacenza_giorno" | "margine_obiettivo_pct">) =>
      ok(await supabase.from("organizations").update(patch).eq("id", id).select("id").single()),
    onSuccess: () => invalida(),
  });
}

// ---------- Esportazione costi ----------

export interface CostoConAuto extends VehicleCost {
  vehicles: { marca: string; modello: string; versione: string | null; targa: string | null; regime_iva: RegimeIva } | null;
}

/** Voci di costo delle auto indicate (a blocchi, per non superare la lunghezza massima dell'URL). */
export async function leggiCostiPerEsportazione(vehicleIds: string[]): Promise<CostoConAuto[]> {
  const out: CostoConAuto[] = [];
  for (let i = 0; i < vehicleIds.length; i += 100) {
    const blocco = vehicleIds.slice(i, i + 100);
    const righe = ok(
      await supabase
        .from("vehicle_costs")
        .select("*, vehicles(marca, modello, versione, targa, regime_iva)")
        .in("vehicle_id", blocco)
        .order("data"),
    ) as unknown as CostoConAuto[];
    out.push(...righe);
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}
