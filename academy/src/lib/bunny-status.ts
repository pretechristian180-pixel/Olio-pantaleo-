// Senza dipendenze dal server: lo usano anche i componenti del browser.

/** Stati di elaborazione di Bunny Stream, in parole semplici. */
export const BUNNY_STATUS: Record<number, { label: string; done: boolean; failed: boolean }> = {
  0: { label: "In attesa del file", done: false, failed: false },
  1: { label: "Caricato, in coda", done: false, failed: false },
  2: { label: "In elaborazione", done: false, failed: false },
  3: { label: "In conversione", done: false, failed: false },
  4: { label: "Pronto", done: true, failed: false },
  5: { label: "Errore di conversione", done: false, failed: true },
  6: { label: "Caricamento non riuscito", done: false, failed: true },
};
