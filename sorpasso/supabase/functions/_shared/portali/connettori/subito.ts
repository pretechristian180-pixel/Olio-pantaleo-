/**
 * Connettore Subito — STRUTTURA PRONTA, CHIAMATE REALI DIETRO FLAG.
 *
 * Attivazione: secrets PORTALE_SUBITO_API_ATTIVA=true e SUBITO_API_URL=<base url>,
 * credenziali in Vault (JSON {"api_key":"…","account_id":"…"}).
 * Endpoint e schema sono da allineare alle specifiche ufficiali che Subito fornisce alle concessionarie.
 * Subito non gestisce la sospensione: un'auto prenotata viene tolta e ripubblicata quando torna disponibile.
 */
import { ErrorePortale, erroreDaRisposta, type AnnuncioVeicolo, type Connettore, type ContestoConnettore } from "../tipi.ts";
import { traduci } from "../mappature/index.ts";

const NOME = "Subito";
const attivo = () => Deno.env.get("PORTALE_SUBITO_API_ATTIVA") === "true";

export function costruisciPayload(a: AnnuncioVeicolo, ctx?: ContestoConnettore) {
  const v = a.veicolo;
  return {
    account_id: ctx?.config?.account_id ?? null,
    category: "auto",
    reference: a.riferimento,
    subject: a.titolo.slice(0, 50),
    body: a.descrizione,
    price: Math.round(a.prezzo),
    town: a.salone.comune,
    phone: a.salone.telefono,
    images: a.foto.slice(0, 20),
    attributes: {
      brand: traduci("subito", "marca", v.marca),
      model: v.modello,
      version: v.versione,
      register_date: v.anno ? `${String(v.mese_immatricolazione ?? 1).padStart(2, "0")}/${v.anno}` : null,
      mileage: v.km,
      fuel: traduci("subito", "alimentazione", v.alimentazione),
      gearbox: traduci("subito", "cambio", v.cambio),
      car_type: traduci("subito", "carrozzeria", v.carrozzeria),
      doors: v.porte,
      seats: v.posti,
      color: v.colore,
      power_kw: v.potenza_kw,
      euro_class: v.classe_euro,
      condition: traduci("subito", "tipo", v.tipo),
    },
  };
}

async function chiama(ctx: ContestoConnettore, metodo: string, percorso: string, body?: unknown) {
  if (!attivo()) {
    throw new ErrorePortale("L'integrazione API con Subito non è ancora attiva. Usa il feed o la pubblicazione manuale.", true);
  }
  let cred: { api_key?: string };
  try {
    cred = JSON.parse(ctx.credenziali ?? "");
  } catch {
    throw new ErrorePortale(`Mancano o non sono valide le credenziali di ${NOME}. Inseriscile in Impostazioni → Portali.`, true);
  }
  const res = await fetch(`${Deno.env.get("SUBITO_API_URL")}${percorso}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${cred.api_key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw await erroreDaRisposta(NOME, res);
  return res.status === 204 ? {} : await res.json().catch(() => ({}));
}

export const connettoreSubito: Connettore = {
  id: "subito",
  nome: NOME,
  apiAttiva: attivo,
  async publish(ctx, a) {
    if (a.prenotata) return { stato: "sospeso" };
    if (a.id_esterno) return this.update(ctx, a);
    const r = await chiama(ctx, "POST", "/ads", costruisciPayload(a, ctx));
    return { stato: "pubblicato", id_esterno: String(r.id ?? ""), url: r.url ?? undefined };
  },
  async update(ctx, a) {
    if (a.prenotata) return this.suspend(ctx, a);
    if (!a.id_esterno) return this.publish(ctx, a);
    await chiama(ctx, "PUT", `/ads/${encodeURIComponent(a.id_esterno)}`, costruisciPayload(a, ctx));
    return { stato: "pubblicato" };
  },
  async suspend(ctx, a) {
    // Nessuna sospensione su Subito: si toglie l'annuncio (verrà ripubblicato se l'auto torna disponibile)
    if (a.id_esterno) await chiama(ctx, "DELETE", `/ads/${encodeURIComponent(a.id_esterno)}`);
    return { stato: "sospeso" };
  },
  async remove(ctx, a) {
    if (a.id_esterno) await chiama(ctx, "DELETE", `/ads/${encodeURIComponent(a.id_esterno)}`);
    return { stato: "rimosso" };
  },
  async getStats(ctx, a) {
    if (!a.id_esterno || !attivo()) return {};
    const r = await chiama(ctx, "GET", `/ads/${encodeURIComponent(a.id_esterno)}/stats`);
    return { visualizzazioni: Number(r.views) || undefined, contatti: Number(r.replies ?? r.contacts) || undefined };
  },
};
