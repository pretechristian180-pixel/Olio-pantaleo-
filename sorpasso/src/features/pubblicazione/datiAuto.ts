/** Dati pubblicabili dell'auto, condivisi da scheda PDF e pagina pubblica (nessuna dipendenza pesante). */
import { ALIMENTAZIONI, CAMBI, TIPI_VEICOLO } from "@/lib/labels";
import { CATALOGO_OPTIONAL, TRAZIONI, kwInCv } from "@/lib/optional";
import type { Vehicle } from "@/types/db";

/** Campi dell'auto che si possono mostrare al pubblico (gli stessi restituiti dalla funzione scheda-pubblica). */
export type AutoPubblica = Pick<
  Vehicle,
  | "id" | "marca" | "modello" | "versione" | "allestimento" | "carrozzeria" | "porte" | "posti" | "anno" | "mese_immatricolazione"
  | "km" | "alimentazione" | "cilindrata" | "potenza_kw" | "cambio" | "trazione" | "classe_euro" | "consumo_misto" | "emissioni_co2"
  | "colore" | "colore_interni" | "numero_proprietari" | "tagliandi_certificati" | "tipo" | "garanzia_mesi" | "garanzia_tipo"
  | "neopatentati" | "optional" | "optional_extra" | "descrizione" | "prezzo_vendita" | "stato"
>;

export interface DatoChiave {
  etichetta: string;
  valore: string;
}

/** Dati principali mostrati in griglia (solo quelli presenti). */
export function datiChiave(v: AutoPubblica): DatoChiave[] {
  const garanzia = v.garanzia_mesi ? `${v.garanzia_mesi} mesi${v.garanzia_tipo ? ` (${v.garanzia_tipo})` : ""}` : null;
  const consumo =
    v.consumo_misto != null ? `${String(v.consumo_misto).replace(".", ",")} ${v.alimentazione === "elettrica" ? "kWh" : "l"}/100 km` : null;
  return [
    { etichetta: "Immatricolazione", valore: v.anno ? `${v.mese_immatricolazione ? `${String(v.mese_immatricolazione).padStart(2, "0")}/` : ""}${v.anno}` : null },
    { etichetta: "Chilometri", valore: `${new Intl.NumberFormat("it-IT").format(v.km)} km` },
    { etichetta: "Condizione", valore: TIPI_VEICOLO[v.tipo] },
    { etichetta: "Alimentazione", valore: v.alimentazione ? ALIMENTAZIONI[v.alimentazione] : null },
    { etichetta: "Potenza", valore: v.potenza_kw ? `${v.potenza_kw} kW (${kwInCv(v.potenza_kw)} CV)` : null },
    { etichetta: "Cilindrata", valore: v.cilindrata ? `${new Intl.NumberFormat("it-IT").format(v.cilindrata)} cm³` : null },
    { etichetta: "Cambio", valore: v.cambio ? CAMBI[v.cambio] : null },
    { etichetta: "Trazione", valore: v.trazione ? TRAZIONI[v.trazione] : null },
    { etichetta: "Carrozzeria", valore: [v.carrozzeria, v.porte && `${v.porte} porte`, v.posti && `${v.posti} posti`].filter(Boolean).join(", ") || null },
    { etichetta: "Classe ambientale", valore: v.classe_euro },
    { etichetta: "Consumo misto", valore: consumo },
    { etichetta: "Emissioni CO2", valore: v.emissioni_co2 != null ? `${v.emissioni_co2} g/km` : null },
    { etichetta: "Colore", valore: v.colore },
    { etichetta: "Interni", valore: v.colore_interni },
    { etichetta: "Proprietari", valore: v.tipo !== "nuovo" && v.numero_proprietari != null ? String(v.numero_proprietari) : null },
    { etichetta: "Tagliandi", valore: v.tagliandi_certificati ? "Certificati" : null },
    { etichetta: "Garanzia", valore: garanzia },
    { etichetta: "Neopatentati", valore: v.neopatentati ? "Sì" : null },
  ].filter((d): d is DatoChiave => !!d.valore);
}

/** Optional raggruppati per categoria del catalogo (le voci non a catalogo vanno in "Altro"). */
export function optionalRaggruppati(v: AutoPubblica): { categoria: string; voci: string[] }[] {
  const scelti = new Set(v.optional ?? []);
  const gruppi = CATALOGO_OPTIONAL.map((c) => ({ categoria: c.categoria, voci: c.voci.filter((x) => scelti.has(x)) })).filter((g) => g.voci.length);
  const noti = new Set(CATALOGO_OPTIONAL.flatMap((c) => c.voci));
  const altri = [...scelti].filter((x) => !noti.has(x));
  if (v.optional_extra?.trim()) altri.push(...v.optional_extra.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean));
  if (altri.length) gruppi.push({ categoria: "Altro", voci: altri });
  return gruppi;
}

