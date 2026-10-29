/**
 * Connettore "Feed XML/CSV": Sorpasso genera un file a un URL privato per concessionaria e portale,
 * il portale lo importa periodicamente. Pubblicare/aggiornare/rimuovere = includere o escludere l'auto dal feed:
 * il feed si genera al momento con i dati attuali, quindi prezzi, foto e stato sono sempre allineati.
 */
import type { Connettore } from "../tipi.ts";

/** Portali che nel feed possono mostrare "prenotata" invece di nascondere l'auto */
const CON_BADGE_PRENOTATA = new Set(["sito"]);

export const connettoreFeed: Connettore = {
  id: "feed",
  nome: "Feed XML/CSV",
  publish: (_ctx, a) => Promise.resolve(a.prenotata && !CON_BADGE_PRENOTATA.has(a.portal_id) ? { stato: "sospeso" } : { stato: "pubblicato" }),
  update: (_ctx, a) => Promise.resolve(a.prenotata && !CON_BADGE_PRENOTATA.has(a.portal_id) ? { stato: "sospeso" } : { stato: "pubblicato" }),
  suspend: (_ctx, a) => Promise.resolve(CON_BADGE_PRENOTATA.has(a.portal_id) ? { stato: "pubblicato" } : { stato: "sospeso" }),
  remove: () => Promise.resolve({ stato: "rimosso" }),
  // I feed non restituiscono statistiche
  getStats: () => Promise.resolve({}),
};
