/** Costruisce l'AnnuncioVeicolo di un listing leggendo i dati con la chiave di servizio. */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { ErrorePortale, type AnnuncioVeicolo } from "./tipi.ts";

/** URL stabile della foto n-esima (la funzione portale-feed reindirizza a un URL firmato fresco). */
export const urlFotoStabile = (tokenPubblico: string, n: number) =>
  `${Deno.env.get("SUPABASE_URL")}/functions/v1/portale-feed/foto/${tokenPubblico}/${n}.jpg`;

const CAMPI = [
  "id", "organization_id", "marca", "modello", "versione", "allestimento", "carrozzeria", "porte", "posti", "anno",
  "mese_immatricolazione", "km", "alimentazione", "cilindrata", "potenza_kw", "cambio", "trazione", "classe_euro",
  "consumo_misto", "emissioni_co2", "colore", "colore_interni", "numero_proprietari", "tagliandi_certificati", "tipo",
  "garanzia_mesi", "garanzia_tipo", "neopatentati", "optional", "descrizione", "descrizione_breve", "prezzo_vendita",
  "stato", "regime_iva", "targa", "telaio", "token_pubblico", "riferimento",
].join(", ");

export async function caricaAnnuncio(sb: SupabaseClient, listingId: string): Promise<AnnuncioVeicolo> {
  const { data: l } = await sb
    .from("vehicle_listings")
    .select("id, vehicle_id, portal_id, prezzo_portale, id_esterno, url, organization_id, portals(foto_max)")
    .eq("id", listingId)
    .maybeSingle();
  if (!l) throw new ErrorePortale("Annuncio non trovato", true);
  const { data: vRaw } = await sb.from("vehicles").select(CAMPI).eq("id", l.vehicle_id).single();
  // deno-lint-ignore no-explicit-any
  const v = vRaw as unknown as Record<string, any>;
  const [{ data: org }, { count }] = await Promise.all([
    sb.from("organizations").select("nome, telefono, whatsapp, email, indirizzo, comune").eq("id", l.organization_id).single(),
    sb.from("vehicle_photos").select("id", { count: "exact", head: true }).eq("vehicle_id", v.id),
  ]);
  const fotoMax = (l.portals as unknown as { foto_max: number } | null)?.foto_max ?? 50;
  const nFoto = Math.min(count ?? 0, fotoMax);
  const prezzo = Number(l.prezzo_portale ?? v.prezzo_vendita);
  if (!Number.isFinite(prezzo) || prezzo <= 0) throw new ErrorePortale("Manca il prezzo dell'auto", true);

  const sito = Deno.env.get("SITE_URL");
  const titolo = [v.marca, v.modello, v.versione].filter(Boolean).join(" ");
  return {
    listing_id: l.id,
    vehicle_id: v.id,
    portal_id: l.portal_id,
    riferimento: v.riferimento,
    id_esterno: l.id_esterno,
    url_esterno: l.url,
    titolo: titolo.slice(0, 120),
    descrizione: `${(v.descrizione ?? "").trim()}\n\nRif. ${v.riferimento}`.trim(),
    descrizione_breve: v.descrizione_breve,
    prezzo,
    prenotata: v.stato === "prenotato",
    foto: Array.from({ length: nFoto }, (_, i) => urlFotoStabile(v.token_pubblico, i + 1)),
    url_scheda: sito ? `${sito.replace(/\/$/, "")}/v/${v.token_pubblico}` : null,
    veicolo: {
      marca: v.marca, modello: v.modello, versione: v.versione, allestimento: v.allestimento, carrozzeria: v.carrozzeria,
      porte: v.porte, posti: v.posti, anno: v.anno, mese_immatricolazione: v.mese_immatricolazione, km: v.km,
      alimentazione: v.alimentazione, cilindrata: v.cilindrata, potenza_kw: v.potenza_kw, cambio: v.cambio,
      trazione: v.trazione, classe_euro: v.classe_euro, consumo_misto: v.consumo_misto, emissioni_co2: v.emissioni_co2,
      colore: v.colore, colore_interni: v.colore_interni, numero_proprietari: v.numero_proprietari,
      tagliandi_certificati: v.tagliandi_certificati, tipo: v.tipo, garanzia_mesi: v.garanzia_mesi,
      garanzia_tipo: v.garanzia_tipo, neopatentati: v.neopatentati, optional: v.optional ?? [],
      regime_iva: v.regime_iva, targa: v.targa, telaio: v.telaio,
    },
    salone: org ?? { nome: "", telefono: null, whatsapp: null, email: null, indirizzo: null, comune: null },
  };
}
