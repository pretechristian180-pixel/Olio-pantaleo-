/**
 * Mappature dei campi per portale (file JSON separati, uno per portale).
 * Ogni portale usa i suoi codici: si modifica solo il JSON del portale, il codice resta uguale.
 */
import generico from "./generico.json" with { type: "json" };
import autoscout24 from "./autoscout24.json" with { type: "json" };
import subito from "./subito.json" with { type: "json" };
import automobileIt from "./automobile_it.json" with { type: "json" };
import meta from "./meta.json" with { type: "json" };

export type Campo = "alimentazione" | "cambio" | "trazione" | "tipo" | "carrozzeria" | "marca" | "optional";
type Mappa = Record<Campo, Record<string, string>>;

const MAPPE: Record<string, Mappa> = {
  autoscout24: autoscout24 as unknown as Mappa,
  subito: subito as unknown as Mappa,
  automobile_it: automobileIt as unknown as Mappa,
  meta: meta as unknown as Mappa,
};

export function mappaPortale(portale: string): Mappa {
  return MAPPE[portale] ?? (generico as unknown as Mappa);
}

/** Valore tradotto per il portale; se non c'è nella mappatura resta il valore originale. */
export function traduci(portale: string, campo: Campo, valore: string | null | undefined): string | null {
  if (valore == null || valore === "") return null;
  return mappaPortale(portale)[campo]?.[valore] ?? valore;
}

/** Valori non presenti nella mappatura (utile per l'anteprima e per completare i file). */
export function nonMappati(portale: string, campo: Campo, valori: (string | null | undefined)[]): string[] {
  const m = mappaPortale(portale)[campo] ?? {};
  return valori.filter((v): v is string => !!v && !(v in m));
}
