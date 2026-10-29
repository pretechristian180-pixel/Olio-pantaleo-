/**
 * Accesso ai dati dello stock: veicoli, foto, documenti del veicolo, storico prezzi,
 * decodifica targa/telaio, clienti compatibili e lead interessati.
 * Il conto economico (costi e ricavi) è in features/economia.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase, BUCKET_DOCUMENTI, BUCKET_FOTO } from "@/lib/supabase";
import { ErroreLeggibile, ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import { comprimiImmagine, percorsoFile } from "@/lib/storage";
import type {
  Alimentazione,
  Cambio,
  ClienteCompatibile,
  Document,
  LeadView,
  TipoDocumento,
  Trazione,
  Vehicle,
  VehiclePhoto,
  VehiclePriceHistory,
  VehicleView,
} from "@/types/db";

export const MAX_FOTO = 50;

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

/** Lead arrivato dalla pagina pubblica della scheda (vedi Edge Function scheda-pubblica). */
export const daSchedaOnline = (l: Pick<LeadView, "fonte" | "richiesta">) =>
  l.fonte === "sito" && /scheda online/i.test(l.richiesta ?? "");

function useInvalidaVeicoli() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.veicoli }),
      qc.invalidateQueries({ queryKey: qk.veicoliSelezionabili }),
      qc.invalidateQueries({ queryKey: qk.oggi }),
      qc.invalidateQueries({ queryKey: ["economia"] }),
    ]);
}

/** Campi della scheda modificabili dal form (il resto lo gestiscono trigger e altre sezioni). */
export type VeicoloInput = Omit<
  Vehicle,
  "id" | "organization_id" | "created_at" | "updated_at" | "data_uscita" | "descrizione" | "descrizione_breve" | "pubblica" | "token_pubblico" | "riferimento"
>;

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
      /** Solo in creazione e solo per i ruoli economici: diventa la voce di costo "Acquisto". */
      prezzoAcquisto?: number | null;
    }) => {
      const salvato = (
        id
          ? ok(await supabase.from("vehicles").update(veicolo).eq("id", id).select("id").single())
          : ok(await supabase.from("vehicles").insert(veicolo).select("id").single())
      ) as { id: string };
      if (!id && prezzoAcquisto != null && prezzoAcquisto > 0) {
        const { error } = await supabase.from("vehicle_costs").insert({
          vehicle_id: salvato.id,
          data: veicolo.data_ingresso,
          categoria: "Acquisto",
          descrizione: "Prezzo di acquisto",
          importo: prezzoAcquisto,
          iva_aliquota: veicolo.regime_iva === "ordinario" ? 22 : 0,
        });
        // L'auto è salvata comunque: il costo si può aggiungere dal conto economico.
        if (error) return { ...salvato, costoNonSalvato: true };
      }
      return { ...salvato, costoNonSalvato: false };
    },
    onSuccess: () => invalida(),
  });
}

export function useAggiornaVeicolo() {
  const invalida = useInvalidaVeicoli();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<Vehicle, "stato" | "descrizione" | "descrizione_breve" | "pubblica">>) =>
      ok(await supabase.from("vehicles").update(patch).eq("id", id).select("id").single()),
    onSuccess: () => invalida(),
  });
}

/* ---------- Decodifica targa / telaio (Edge Function decodifica-veicolo) ---------- */

export interface DatiDecodificati {
  marca?: string;
  modello?: string;
  versione?: string;
  allestimento?: string;
  carrozzeria?: string;
  porte?: number;
  posti?: number;
  anno?: number;
  mese_immatricolazione?: number;
  alimentazione?: Alimentazione;
  cilindrata?: number;
  potenza_kw?: number;
  cambio?: Cambio;
  trazione?: Trazione;
  classe_euro?: string;
  consumo_misto?: number;
  emissioni_co2?: number;
  colore?: string;
  telaio?: string;
  targa?: string;
}

export async function decodificaVeicolo(richiesta: { targa: string } | { telaio: string }) {
  const { data, error } = await supabase.functions.invoke<{ dati: DatiDecodificati | null; messaggio?: string }>("decodifica-veicolo", {
    body: richiesta,
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new ErroreLeggibile(body?.error ?? "Decodifica non riuscita: compila i campi a mano.");
    }
    throw new ErroreLeggibile("Servizio di decodifica non raggiungibile: compila i campi a mano.");
  }
  return data ?? { dati: null };
}

/* ---------- Foto ---------- */

export function useCaricaFoto() {
  const invalida = useInvalidaVeicoli();
  return useMutation({
    mutationFn: async ({
      orgId,
      vehicleId,
      files,
      ordineIniziale,
      onProgresso,
    }: {
      orgId: string;
      vehicleId: string;
      files: File[];
      ordineIniziale: number;
      onProgresso?: (fatte: number, totali: number) => void;
    }) => {
      let ordine = ordineIniziale;
      let fatte = 0;
      onProgresso?.(0, files.length);
      for (const file of files) {
        const blob = await comprimiImmagine(file);
        const path = percorsoFile(orgId, `veicoli/${vehicleId}`, blob.type === "image/jpeg" ? "foto.jpg" : file.name);
        const up = await supabase.storage.from(BUCKET_FOTO).upload(path, blob, { contentType: blob.type || file.type, upsert: false });
        if (up.error) throw up.error;
        const ins = await supabase.from("vehicle_photos").insert({ vehicle_id: vehicleId, storage_path: path, ordine: ordine++ });
        if (ins.error) {
          await supabase.storage.from(BUCKET_FOTO).remove([path]);
          throw ins.error;
        }
        onProgresso?.(++fatte, files.length);
      }
    },
    onSettled: () => invalida(),
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

/** Salva il nuovo ordine delle foto: la prima è la copertina. Aggiorna solo quelle cambiate. */
export function useRiordinaFoto() {
  const qc = useQueryClient();
  const invalida = useInvalidaVeicoli();
  return useMutation({
    mutationFn: async ({ ordinate }: { vehicleId: string; ordinate: VehiclePhoto[] }) => {
      const cambiate = ordinate.map((f, i) => ({ f, i })).filter(({ f, i }) => f.ordine !== i);
      await Promise.all(
        cambiate.map(async ({ f, i }) => {
          const { error } = await supabase.from("vehicle_photos").update({ ordine: i }).eq("id", f.id);
          if (error) throw error;
        }),
      );
    },
    // Aggiornamento ottimistico: la galleria si riordina subito, torna indietro se fallisce.
    onMutate: async ({ vehicleId, ordinate }) => {
      const key = [...qk.veicoli, "foto", vehicleId];
      await qc.cancelQueries({ queryKey: key });
      const prima = qc.getQueryData<VehiclePhoto[]>(key);
      qc.setQueryData<VehiclePhoto[]>(key, ordinate.map((f, i) => ({ ...f, ordine: i })));
      return { key, prima };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prima);
    },
    onSettled: () => invalida(),
  });
}

/* ---------- Documenti del veicolo (privati: solo ruoli economici, vedi RLS) ---------- */

export function useDocumentiVeicolo(vehicleId: string | undefined, abilitato: boolean) {
  return useQuery({
    queryKey: [...qk.veicoli, "documenti", vehicleId],
    enabled: !!vehicleId && abilitato,
    queryFn: async () =>
      ok(await supabase.from("documents").select("*").eq("vehicle_id", vehicleId!).order("created_at", { ascending: false })) as Document[],
  });
}

const FORMATI_DOCUMENTO = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function useCaricaDocumentoVeicolo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, vehicleId, tipo, file }: { orgId: string; vehicleId: string; tipo: TipoDocumento; file: File }) => {
      if (!FORMATI_DOCUMENTO.includes(file.type)) throw new ErroreLeggibile("Formato non supportato: carica un PDF o una foto (JPG, PNG, WEBP).");
      if (file.size > 15 * 1024 * 1024) throw new ErroreLeggibile("Il file supera i 15 MB.");
      const path = percorsoFile(orgId, `veicoli/${vehicleId}`, file.name);
      const up = await supabase.storage.from(BUCKET_DOCUMENTI).upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const ins = await supabase
        .from("documents")
        .insert({ vehicle_id: vehicleId, tipo, nome_file: file.name, storage_path: path, dimensione_byte: file.size });
      if (ins.error) {
        await supabase.storage.from(BUCKET_DOCUMENTI).remove([path]);
        throw ins.error;
      }
    },
    onSuccess: (_d, { vehicleId }) => qc.invalidateQueries({ queryKey: [...qk.veicoli, "documenti", vehicleId] }),
  });
}

export function useEliminaDocumentoVeicolo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: Document) => {
      ok(await supabase.from("documents").delete().eq("id", doc.id));
      await supabase.storage.from(BUCKET_DOCUMENTI).remove([doc.storage_path]);
    },
    onSuccess: (_d, doc) => qc.invalidateQueries({ queryKey: [...qk.veicoli, "documenti", doc.vehicle_id] }),
  });
}
