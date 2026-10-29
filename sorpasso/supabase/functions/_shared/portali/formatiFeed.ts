/**
 * Formati dei feed generati da Sorpasso:
 *   - XML generico Sorpasso (struttura documentata qui sotto, valori tradotti con la mappatura del portale)
 *   - CSV generico (stessi campi)
 *   - CSV catalogo veicoli Meta (Facebook/Instagram), con i nomi colonna della specifica Meta
 * Le specifiche ufficiali di import dei singoli portali vanno verificate al momento dell'attivazione:
 * eventuali formati dedicati si aggiungono qui senza toccare il resto.
 */
import type { AnnuncioVeicolo } from "./tipi.ts";
import { traduci } from "./mappature/index.ts";

const xml = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const csvCampo = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function campiComuni(a: AnnuncioVeicolo, portale: string) {
  const v = a.veicolo;
  return {
    riferimento: a.riferimento,
    titolo: a.titolo,
    marca: traduci(portale, "marca", v.marca),
    modello: v.modello,
    versione: v.versione,
    allestimento: v.allestimento,
    condizione: traduci(portale, "tipo", v.tipo),
    carrozzeria: traduci(portale, "carrozzeria", v.carrozzeria),
    immatricolazione: v.anno ? `${v.anno}-${String(v.mese_immatricolazione ?? 1).padStart(2, "0")}` : "",
    km: v.km,
    alimentazione: traduci(portale, "alimentazione", v.alimentazione),
    cambio: traduci(portale, "cambio", v.cambio),
    trazione: traduci(portale, "trazione", v.trazione),
    potenza_kw: v.potenza_kw,
    potenza_cv: v.potenza_kw ? Math.round(v.potenza_kw * 1.35962) : "",
    cilindrata: v.cilindrata,
    porte: v.porte,
    posti: v.posti,
    classe_euro: v.classe_euro,
    consumo_misto: v.consumo_misto,
    co2: v.emissioni_co2,
    colore: v.colore,
    interni: v.colore_interni,
    proprietari: v.numero_proprietari,
    tagliandi_certificati: v.tagliandi_certificati ? "si" : "no",
    garanzia_mesi: v.garanzia_mesi,
    neopatentati: v.neopatentati ? "si" : "no",
    iva_esposta: v.regime_iva === "ordinario" ? "si" : "no",
    prezzo: a.prezzo.toFixed(2),
    prenotata: a.prenotata ? "si" : "no",
    url: a.url_scheda,
    descrizione: a.descrizione,
  };
}

export function feedXml(annunci: AnnuncioVeicolo[], portale: string, salone: AnnuncioVeicolo["salone"]): string {
  const righe = annunci.map((a) => {
    const c = campiComuni(a, portale);
    const optional = a.veicolo.optional.map((o) => `      <optional>${xml(traduci(portale, "optional", o))}</optional>`).join("\n");
    const foto = a.foto.map((f, i) => `      <foto ordine="${i + 1}">${xml(f)}</foto>`).join("\n");
    const campi = Object.entries(c)
      .filter(([k]) => k !== "riferimento")
      .map(([k, v]) => `    <${k}>${xml(v)}</${k}>`)
      .join("\n");
    return `  <annuncio riferimento="${xml(c.riferimento)}">\n${campi}\n    <optionals>\n${optional}\n    </optionals>\n    <fotos>\n${foto}\n    </fotos>\n  </annuncio>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Feed Sorpasso AI · formato generico v1 · ${annunci.length} annunci -->
<annunci generato="${new Date().toISOString()}" portale="${xml(portale)}">
  <concessionaria>
    <nome>${xml(salone.nome)}</nome>
    <telefono>${xml(salone.telefono)}</telefono>
    <email>${xml(salone.email)}</email>
    <indirizzo>${xml(salone.indirizzo)}</indirizzo>
    <comune>${xml(salone.comune)}</comune>
  </concessionaria>
${righe.join("\n")}
</annunci>
`;
}

export function feedCsv(annunci: AnnuncioVeicolo[], portale: string): string {
  if (!annunci.length) return "riferimento\n";
  const colonne = [...Object.keys(campiComuni(annunci[0]!, portale)), "optional", "foto"];
  const righe = annunci.map((a) => {
    const c = campiComuni(a, portale) as Record<string, unknown>;
    c.optional = a.veicolo.optional.map((o) => traduci(portale, "optional", o)).join("|");
    c.foto = a.foto.join("|");
    return colonne.map((k) => csvCampo(c[k])).join(",");
  });
  return [colonne.join(","), ...righe].join("\n") + "\n";
}

/** Catalogo veicoli Meta: una riga per auto, colonne secondo la specifica "vehicles" di Commerce Manager. */
export function feedMetaCsv(annunci: AnnuncioVeicolo[]): string {
  const maxFoto = Math.min(20, Math.max(1, ...annunci.map((a) => a.foto.length)));
  const colonne = [
    "vehicle_id", "title", "description", "url", "make", "model", "year", "mileage.value", "mileage.unit",
    "price", "state_of_vehicle", "exterior_color", "body_style", "fuel_type", "transmission", "drivetrain", "trim",
    "address.addr1", "address.city", "address.country", "availability",
    ...Array.from({ length: maxFoto }, (_, i) => `image[${i}].url`),
  ];
  const righe = annunci.map((a) => {
    const v = a.veicolo;
    const valori: Record<string, unknown> = {
      "vehicle_id": a.riferimento,
      "title": a.titolo,
      "description": (a.descrizione_breve || a.descrizione).slice(0, 5000),
      "url": a.url_scheda,
      "make": v.marca,
      "model": v.modello,
      "year": v.anno,
      "mileage.value": v.km,
      "mileage.unit": "KM",
      "price": `${a.prezzo.toFixed(2)} EUR`,
      "state_of_vehicle": traduci("meta", "tipo", v.tipo),
      "exterior_color": v.colore,
      "body_style": traduci("meta", "carrozzeria", v.carrozzeria) ?? "OTHER",
      "fuel_type": traduci("meta", "alimentazione", v.alimentazione),
      "transmission": traduci("meta", "cambio", v.cambio),
      "drivetrain": traduci("meta", "trazione", v.trazione),
      "trim": [v.versione, v.allestimento].filter(Boolean).join(" "),
      "address.addr1": a.salone.indirizzo,
      "address.city": a.salone.comune,
      "address.country": "IT",
      "availability": a.prenotata ? "PENDING" : "AVAILABLE",
    };
    a.foto.slice(0, maxFoto).forEach((f, i) => (valori[`image[${i}].url`] = f));
    return colonne.map((k) => csvCampo(valori[k])).join(",");
  });
  return [colonne.join(","), ...righe].join("\n") + "\n";
}
