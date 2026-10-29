/**
 * Provider generico via HTTP: collega qualunque servizio di dati veicolo che risponda in JSON
 * con i campi di DatiDecodificati (eventualmente tramite un piccolo adattatore lato provider).
 *
 * Secrets:
 *   DECODER_HTTP_URL      es. https://api.fornitore.it/v1/veicolo?targa={targa}&vin={telaio}
 *   DECODER_HTTP_API_KEY  inviata nell'header indicato da DECODER_HTTP_HEADER (default "Authorization: Bearer …")
 *   DECODER_HTTP_HEADER   facoltativo, es. "X-Api-Key"
 */
import type { DatiDecodificati, VehicleDecoder } from "./tipi.ts";

const NUMERICI = ["porte", "posti", "anno", "mese_immatricolazione", "cilindrata", "potenza_kw", "consumo_misto", "emissioni_co2"] as const;
const TESTUALI = ["marca", "modello", "versione", "allestimento", "carrozzeria", "classe_euro", "colore", "telaio", "targa"] as const;
const ALIMENTAZIONI = ["benzina", "diesel", "gpl", "metano", "ibrida", "ibrida_plugin", "elettrica"];

/** Tiene solo i campi noti e con il tipo giusto: i dati esterni non sono affidabili per definizione. */
export function pulisci(raw: Record<string, unknown>): DatiDecodificati {
  const out: DatiDecodificati = {};
  for (const k of TESTUALI) if (typeof raw[k] === "string" && raw[k]) (out as Record<string, unknown>)[k] = String(raw[k]).slice(0, 120);
  for (const k of NUMERICI) {
    const n = Number(raw[k]);
    if (raw[k] != null && Number.isFinite(n) && n >= 0) (out as Record<string, unknown>)[k] = n;
  }
  if (typeof raw.alimentazione === "string" && ALIMENTAZIONI.includes(raw.alimentazione)) out.alimentazione = raw.alimentazione as DatiDecodificati["alimentazione"];
  if (raw.cambio === "manuale" || raw.cambio === "automatico") out.cambio = raw.cambio;
  if (raw.trazione === "anteriore" || raw.trazione === "posteriore" || raw.trazione === "integrale") out.trazione = raw.trazione;
  return out;
}

export const httpGenerico: VehicleDecoder = {
  id: "http",
  nome: "Servizio esterno (HTTP)",
  descrizione: "Un fornitore di dati veicolo configurato dall'amministratore tecnico con i secrets DECODER_HTTP_*.",
  supportaTarga: true,
  supportaTelaio: true,
  configurato: () => !!Deno.env.get("DECODER_HTTP_URL"),
  async decodifica({ targa, telaio }) {
    const modello = Deno.env.get("DECODER_HTTP_URL");
    if (!modello) return null;
    const url = modello
      .replace("{targa}", encodeURIComponent(targa ?? ""))
      .replace("{telaio}", encodeURIComponent(telaio ?? ""));
    const chiave = Deno.env.get("DECODER_HTTP_API_KEY");
    const header = Deno.env.get("DECODER_HTTP_HEADER");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (chiave) headers[header || "Authorization"] = header ? chiave : `Bearer ${chiave}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`provider http ${res.status}`);
    return pulisci(await res.json());
  },
};
