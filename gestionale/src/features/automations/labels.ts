import type { Tone } from "@/lib/labels";
import type { ActionKind, Automation, RunState, TemplateState, WaitUnit } from "@/types/automations";

export const unitLabel: Record<WaitUnit, { one: string; many: string }> = {
  minuti: { one: "minuto", many: "minuti" },
  ore: { one: "ora", many: "ore" },
  ore_lavorative: { one: "ora lavorativa", many: "ore lavorative" },
  giorni: { one: "giorno", many: "giorni" },
  giorni_lavorativi: { one: "giorno lavorativo", many: "giorni lavorativi" },
};
export const waitText = (v: number, u: WaitUnit) => (v === 0 ? "subito" : `${v} ${v === 1 ? unitLabel[u].one : unitLabel[u].many}`);

export const actionLabel: Record<ActionKind, string> = {
  whatsapp: "WhatsApp al cliente",
  email: "Email",
  task: "Cosa da fare",
  notifica_interna: "Avviso interno",
  evento_agenda: "Appuntamento in agenda",
  cambio_temperatura: "Cambio temperatura",
};

export const templateState: Record<TemplateState, { label: string; tone: Tone }> = {
  bozza: { label: "Da far approvare a Meta", tone: "orange" },
  in_revisione: { label: "In revisione da Meta", tone: "sky" },
  approvato: { label: "Approvato da Meta", tone: "green" },
  rifiutato: { label: "Rifiutato da Meta", tone: "red" },
};

export const runState: Record<RunState, { label: string; tone: Tone }> = {
  in_attesa: { label: "In programma", tone: "navy" },
  eseguita: { label: "Fatta", tone: "green" },
  annullata: { label: "Annullata", tone: "gray" },
  saltata: { label: "Saltata", tone: "orange" },
  fallita: { label: "Non riuscita", tone: "red" },
};

/** Variabili che si possono inserire nei testi, con un esempio per l'anteprima */
export const variables: { key: string; label: string; sample: string }[] = [
  { key: "nome", label: "Nome del cliente", sample: "Maria" },
  { key: "nome_agente", label: "Nome dell'agente", sample: "Giuseppe Lorusso" },
  { key: "nome_agenzia", label: "Nome dell'agenzia", sample: "Immobiliare Levante" },
  { key: "indirizzo_immobile", label: "Indirizzo dell'immobile", sample: "Via Roma 48" },
  { key: "prezzo_immobile", label: "Prezzo", sample: "245.000 €" },
  { key: "data_appuntamento", label: "Data dell'appuntamento", sample: "05/11/2026" },
  { key: "ora_appuntamento", label: "Ora dell'appuntamento", sample: "17:30" },
  { key: "link_recensioni", label: "Link recensioni", sample: "https://g.page/r/…" },
  { key: "link_questionario", label: "Link al questionario", sample: "https://…/questionario/…" },
  { key: "visite", label: "Visite (report)", sample: "4" },
  { key: "richieste", label: "Interessati (report)", sample: "6" },
  { key: "giorni_online", label: "Giorni sul mercato", sample: "38" },
];
export const sampleVars = Object.fromEntries(
  variables.map((v) => [v.key, v.sample]).concat([["cognome", "Rossi"], ["festivita", "buon Natale e un felice anno nuovo"], ["data_scadenza", "30/11/2026"], ["ora_creazione", "10:15"]]),
);

export function fill(text: string, vars: Record<string, string> = sampleVars) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

/** Testo da registrare su Meta: le variabili diventano {{1}}, {{2}}… nell'ordine */
export function metaText(text: string) {
  let i = 0;
  return text.replace(/\{\{\s*[a-z_]+\s*\}\}/g, () => `{{${++i}}}`);
}

/** Frase "Quando … aspetta …" per le automazioni create a mano */
export function whenText(a: Pick<Automation, "trigger" | "entity" | "conditions" | "waitValue" | "waitUnit" | "waitDirection">) {
  const c = a.conditions as Record<string, string>;
  const w = waitText(a.waitValue, a.waitUnit);
  switch (a.trigger) {
    case "creazione":
      return `Quando arriva un nuovo ${a.entity === "contact" ? "contatto" : "elemento"}, ${w === "subito" ? "subito" : `dopo ${w}`}`;
    case "cambio_fase":
      return `Quando ${a.entity === "deal" ? "una trattativa" : a.entity === "acquisition" ? "un'acquisizione" : "un immobile"} passa a "${String(c.fase ?? c.stato ?? "").replace(/_/g, " ")}", ${w === "subito" ? "subito" : `dopo ${w}`}`;
    case "data_evento":
      return `${w === "subito" ? "All'ora" : `${w} ${a.waitDirection === "prima" ? "prima" : "dopo"}`} di ogni appuntamento di tipo "${c.tipo ?? "qualsiasi"}"`;
    default:
      return "";
  }
}
