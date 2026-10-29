/**
 * Connettore API AutoScout24 — STRUTTURA PRONTA, CHIAMATE REALI DIETRO FLAG.
 *
 * Attivazione (quando la concessionaria è abilitata come partner dati e si hanno le specifiche):
 *   secrets: PORTALE_AUTOSCOUT24_API_ATTIVA=true, AUTOSCOUT24_API_URL=<base url API>
 *   credenziali (Impostazioni → Portali, salvate in Vault) in JSON: {"client_id":"…","client_secret":"…","customer_id":"…"}
 *
 * Endpoint, autenticazione e schema del payload sono da verificare sulla documentazione ufficiale:
 * qui sono isolati in costruisciPayload() e nelle quattro chiamate, così l'adattamento è locale.
 * Con il flag spento il connettore non chiama nulla e restituisce un errore chiaro;
 * l'operazione "anteprima" mostra comunque il payload che verrebbe inviato.
 */
import { ErrorePortale, erroreDaRisposta, type AnnuncioVeicolo, type Connettore, type ContestoConnettore } from "../tipi.ts";
import { traduci } from "../mappature/index.ts";

const NOME = "AutoScout24";
const attivo = () => Deno.env.get("PORTALE_AUTOSCOUT24_API_ATTIVA") === "true";

export function costruisciPayload(a: AnnuncioVeicolo, ctx?: ContestoConnettore) {
  const v = a.veicolo;
  return {
    customerId: ctx?.config?.customer_id ?? null,
    externalId: a.riferimento,
    make: traduci("autoscout24", "marca", v.marca),
    model: v.modello,
    modelVersion: [v.versione, v.allestimento].filter(Boolean).join(" ") || null,
    offerType: traduci("autoscout24", "tipo", v.tipo),
    bodyType: traduci("autoscout24", "carrozzeria", v.carrozzeria),
    firstRegistration: v.anno ? `${v.anno}-${String(v.mese_immatricolazione ?? 1).padStart(2, "0")}` : null,
    mileage: v.km,
    fuelType: traduci("autoscout24", "alimentazione", v.alimentazione),
    transmission: traduci("autoscout24", "cambio", v.cambio),
    driveTrain: traduci("autoscout24", "trazione", v.trazione),
    power: v.potenza_kw,
    cubicCapacity: v.cilindrata,
    doors: v.porte,
    seats: v.posti,
    emissionClass: v.classe_euro,
    consumptionCombined: v.consumo_misto,
    co2Emission: v.emissioni_co2,
    bodyColor: v.colore,
    interiorColor: v.colore_interni,
    previousOwners: v.numero_proprietari,
    fullServiceHistory: v.tagliandi_certificati,
    warrantyMonths: v.garanzia_mesi,
    equipment: v.optional.map((o) => traduci("autoscout24", "optional", o)),
    price: { amount: a.prezzo, currency: "EUR", vatDeductible: v.regime_iva === "ordinario" },
    description: a.descrizione,
    images: a.foto,
    reserved: a.prenotata,
  };
}

async function token(ctx: ContestoConnettore): Promise<string> {
  if (!ctx.credenziali) throw new ErrorePortale(`Mancano le credenziali di ${NOME}. Inseriscile in Impostazioni → Portali.`, true);
  let cred: { client_id?: string; client_secret?: string };
  try {
    cred = JSON.parse(ctx.credenziali);
  } catch {
    throw new ErrorePortale(`Credenziali di ${NOME} in formato non valido.`, true);
  }
  // DA VERIFICARE: flusso OAuth2 client credentials del portale
  const res = await fetch(`${Deno.env.get("AUTOSCOUT24_API_URL")}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: cred.client_id ?? "", client_secret: cred.client_secret ?? "" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw await erroreDaRisposta(NOME, res);
  return (await res.json()).access_token;
}

async function chiama(ctx: ContestoConnettore, metodo: string, percorso: string, body?: unknown) {
  if (!attivo()) {
    throw new ErrorePortale("L'integrazione API con AutoScout24 non è ancora attiva. Usa il feed o la pubblicazione manuale.", true);
  }
  const res = await fetch(`${Deno.env.get("AUTOSCOUT24_API_URL")}${percorso}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${await token(ctx)}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw await erroreDaRisposta(NOME, res);
  return res.status === 204 ? {} : await res.json().catch(() => ({}));
}

export const connettoreAutoScout24: Connettore = {
  id: "autoscout24",
  nome: NOME,
  apiAttiva: attivo,
  async publish(ctx, a) {
    if (a.id_esterno) return this.update(ctx, a);
    const r = await chiama(ctx, "POST", "/listings", costruisciPayload(a, ctx));
    return { stato: a.prenotata ? "sospeso" : "pubblicato", id_esterno: String(r.id ?? ""), url: r.url ?? undefined };
  },
  async update(ctx, a) {
    if (!a.id_esterno) return this.publish(ctx, a);
    await chiama(ctx, "PUT", `/listings/${encodeURIComponent(a.id_esterno)}`, costruisciPayload(a, ctx));
    return { stato: a.prenotata ? "sospeso" : "pubblicato" };
  },
  async suspend(ctx, a) {
    if (!a.id_esterno) return { stato: "sospeso" };
    await chiama(ctx, "PATCH", `/listings/${encodeURIComponent(a.id_esterno)}`, { status: "inactive" });
    return { stato: "sospeso" };
  },
  async remove(ctx, a) {
    if (!a.id_esterno) return { stato: "rimosso" };
    await chiama(ctx, "DELETE", `/listings/${encodeURIComponent(a.id_esterno)}`);
    return { stato: "rimosso" };
  },
  async getStats(ctx, a) {
    if (!a.id_esterno || !attivo()) return {};
    const r = await chiama(ctx, "GET", `/listings/${encodeURIComponent(a.id_esterno)}/statistics`);
    return { visualizzazioni: Number(r.views ?? r.detailViews) || undefined, contatti: Number(r.contacts ?? r.leads) || undefined };
  },
};
