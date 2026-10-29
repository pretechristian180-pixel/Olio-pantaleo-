/**
 * Versione dimostrativa navigabile senza backend (build con VITE_DEMO=1, vedi scripts/demo/README.md).
 * Nella build normale DEMO è false e tutto il codice della demo viene eliminato dal bundle.
 */
export const DEMO = import.meta.env.VITE_DEMO === "1";
export const DEMO_URL = "https://demo.sorpasso.invalid";
/** Momento della registrazione dei dati: l'orologio dell'app parte da qui. */
export const DEMO_ORA = Number(import.meta.env.VITE_DEMO_ORA ?? 0);
export const DEMO_UTENTE = {
  id: import.meta.env.VITE_DEMO_UTENTE_ID ?? "00000000-0000-0000-0000-000000000000",
  email: "titolare@demo.sorpasso.it",
};
