/**
 * Connettore "Manuale assistito": per i portali senza integrazione.
 * Non chiama nessun portale: segna sull'annuncio cosa deve fare l'utente
 * ("pubblica", "aggiorna", "sospendi", "rimuovi"); l'utente usa "Copia annuncio" / zip foto,
 * poi incolla l'URL o conferma con "Fatto" (funzione conferma_azione_manuale).
 */
import type { Connettore } from "../tipi.ts";

export const connettoreManuale: Connettore = {
  id: "manuale",
  nome: "Manuale assistito",
  publish: (_ctx, a) => Promise.resolve(a.url_esterno ? { azione_manuale: "aggiorna" } : { stato: "in_pubblicazione", azione_manuale: "pubblica" }),
  update: (_ctx, a) => Promise.resolve(a.url_esterno ? { azione_manuale: "aggiorna" } : { azione_manuale: "pubblica" }),
  suspend: (_ctx, a) => Promise.resolve(a.url_esterno ? { azione_manuale: "sospendi" } : { stato: "sospeso", azione_manuale: null }),
  remove: (_ctx, a) => Promise.resolve(a.url_esterno ? { azione_manuale: "rimuovi" } : { stato: "rimosso", azione_manuale: null }),
  getStats: () => Promise.resolve({}),
};
