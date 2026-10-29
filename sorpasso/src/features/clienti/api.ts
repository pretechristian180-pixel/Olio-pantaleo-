/** Dati dei clienti (contatti): elenco con conteggi, dettaglio, documenti. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, BUCKET_DOCUMENTI } from "@/lib/supabase";
import { ErroreLeggibile, ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import { percorsoFile } from "@/lib/storage";
import { STATI_APERTI } from "@/lib/labels";
import type { Contact, Deal, Document, LeadView, StatoLead, TipoDocumento } from "@/types/db";

export interface ContattoElenco extends Contact {
  leads: { id: string; stato: StatoLead }[];
  deals: { id: string }[];
}

export const leadAperti = (c: ContattoElenco) => c.leads.filter((l) => STATI_APERTI.includes(l.stato)).length;

export function useContatti() {
  return useQuery({
    queryKey: [...qk.contatti, "elenco"],
    queryFn: async () =>
      ok(
        await supabase
          .from("contacts")
          .select("*, leads(id, stato), deals(id)")
          .order("created_at", { ascending: false })
          .limit(2000),
      ) as unknown as ContattoElenco[],
  });
}

export function useContatto(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.contatti, "dettaglio", id],
    enabled: !!id,
    queryFn: async () => ok(await supabase.from("contacts").select("*").eq("id", id!).single()) as Contact,
  });
}

export function useLeadContatto(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.lead, "contatto", id],
    enabled: !!id,
    queryFn: async () =>
      ok(await supabase.from("leads_view").select("*").eq("contact_id", id!).order("created_at", { ascending: false })) as LeadView[],
  });
}

export interface AcquistoContatto extends Deal {
  vehicles: { id: string; marca: string; modello: string; versione: string | null; targa: string | null } | null;
}

export function useAcquistiContatto(id: string | undefined) {
  return useQuery({
    queryKey: [...qk.pratiche, "contatto", id],
    enabled: !!id,
    queryFn: async () =>
      ok(
        await supabase
          .from("deals")
          .select("*, vehicles(id, marca, modello, versione, targa)")
          .eq("contact_id", id!)
          .order("data_vendita", { ascending: false }),
      ) as unknown as AcquistoContatto[],
  });
}

export function useAggiornaContatto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Contact> & { id: string }) =>
      ok(await supabase.from("contacts").update(patch).eq("id", id).select("id").single()),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.contatti }),
        qc.invalidateQueries({ queryKey: qk.lead }),
      ]),
  });
}

/* ---------- Documenti (condivisi con le pratiche) ---------- */

const qkDocumenti = (rif: RiferimentoDocumenti) => ["documenti", rif.tipo, rif.id] as const;

export interface RiferimentoDocumenti {
  tipo: "contatto" | "pratica";
  id: string;
  /** Per le pratiche: il documento viene collegato anche al cliente. */
  contactId?: string;
}

export function useDocumenti(rif: RiferimentoDocumenti) {
  return useQuery({
    queryKey: qkDocumenti(rif),
    queryFn: async () =>
      ok(
        await supabase
          .from("documents")
          .select("*")
          .eq(rif.tipo === "contatto" ? "contact_id" : "deal_id", rif.id)
          .order("created_at", { ascending: false }),
      ) as Document[],
  });
}

const DIMENSIONE_MAX = 15 * 1024 * 1024;
const FORMATI = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function useCaricaDocumento(rif: RiferimentoDocumenti) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, tipo, orgId }: { file: File; tipo: TipoDocumento; orgId: string }) => {
      if (!FORMATI.includes(file.type)) throw new ErroreLeggibile("Formato non supportato: carica una foto (JPG, PNG, WEBP) o un PDF.");
      if (file.size > DIMENSIONE_MAX) throw new ErroreLeggibile("Il file supera i 15 MB.");
      const cartella = rif.tipo === "contatto" ? `clienti/${rif.id}` : `pratiche/${rif.id}`;
      const path = percorsoFile(orgId, cartella, file.name);
      ok(await supabase.storage.from(BUCKET_DOCUMENTI).upload(path, file, { contentType: file.type }));
      const { error } = await supabase.from("documents").insert({
        tipo,
        nome_file: file.name,
        storage_path: path,
        dimensione_byte: file.size,
        contact_id: rif.tipo === "contatto" ? rif.id : (rif.contactId ?? null),
        deal_id: rif.tipo === "pratica" ? rif.id : null,
      });
      if (error) {
        // Riga non salvata: niente file orfani nello Storage.
        await supabase.storage.from(BUCKET_DOCUMENTI).remove([path]);
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documenti"] }),
  });
}

export function useEliminaDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: Document) => {
      ok(await supabase.from("documents").delete().eq("id", doc.id));
      await supabase.storage.from(BUCKET_DOCUMENTI).remove([doc.storage_path]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documenti"] }),
  });
}
