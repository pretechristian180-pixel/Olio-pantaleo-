export const euro = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(n));

export const data = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("it-IT") : "—");
export const dataOra = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "—";

/** Stato SDI (ei_status di Fatture in Cloud) in italiano, con colore. */
export const STATI_SDI: Record<string, { etichetta: string; colore: string }> = {
  not_sent: { etichetta: "Non inviata (prova)", colore: "bg-slate-100 text-slate-700" },
  attempt: { etichetta: "In invio", colore: "bg-sky-100 text-sky-800" },
  sent: { etichetta: "Inviata", colore: "bg-sky-100 text-sky-800" },
  pending: { etichetta: "In attesa", colore: "bg-sky-100 text-sky-800" },
  processing: { etichetta: "In elaborazione", colore: "bg-sky-100 text-sky-800" },
  no_response: { etichetta: "Nessuna risposta", colore: "bg-amber-100 text-amber-800" },
  accepted: { etichetta: "Consegnata", colore: "bg-emerald-100 text-emerald-800" },
  manual_accepted: { etichetta: "Accettata", colore: "bg-emerald-100 text-emerald-800" },
  not_delivered: { etichetta: "Non consegnata (nel cassetto fiscale)", colore: "bg-emerald-100 text-emerald-800" },
  rejected: { etichetta: "Rifiutata", colore: "bg-red-100 text-red-800" },
  manual_rejected: { etichetta: "Rifiutata", colore: "bg-red-100 text-red-800" },
  discarded: { etichetta: "Scartata", colore: "bg-red-100 text-red-800" },
  error: { etichetta: "Errore", colore: "bg-red-100 text-red-800" },
};

export const STATI_JOB: Record<string, string> = {
  in_coda: "bg-slate-100 text-slate-700",
  in_lavorazione: "bg-sky-100 text-sky-800",
  emessa: "bg-indigo-100 text-indigo-800",
  inviata: "bg-sky-100 text-sky-800",
  accettata: "bg-emerald-100 text-emerald-800",
  scartata: "bg-red-100 text-red-800",
  errore: "bg-red-100 text-red-800",
  dati_mancanti: "bg-amber-100 text-amber-800",
  da_controllare: "bg-amber-100 text-amber-800",
};

export const SCARTATI = ["rejected", "manual_rejected", "discarded", "error"];
