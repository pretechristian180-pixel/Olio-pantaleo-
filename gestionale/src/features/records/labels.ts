import type { DocCategory, PriceOpinion, VisitIntent } from "@/types/records";

export const docCategoryLabel: Record<DocCategory, string> = {
  identita: "Documento d'identità",
  provenienza: "Atto di provenienza",
  catasto: "Visura catastale",
  planimetria: "Planimetria",
  ape: "APE",
  urbanistica: "Conformità urbanistica",
  impianti: "Impianti",
  condominio: "Condominio",
  incarico: "Incarico",
  proposta: "Proposta d'acquisto",
  preliminare: "Preliminare / compromesso",
  rogito: "Rogito",
  antiriciclaggio: "Antiriciclaggio",
  foto: "Foto",
  altro: "Altro",
};

/** Indovina la categoria dal nome della voce di checklist */
export function guessCategory(label: string): DocCategory {
  const l = label.toLowerCase();
  if (l.includes("identit")) return "identita";
  if (l.includes("provenienza")) return "provenienza";
  if (l.includes("visura")) return "catasto";
  if (l.includes("planimetria")) return "planimetria";
  if (l.includes("ape")) return "ape";
  if (l.includes("urbanistic") || l.includes("agibilit")) return "urbanistica";
  if (l.includes("impiant")) return "impianti";
  if (l.includes("condomin")) return "condominio";
  if (l.includes("incarico")) return "incarico";
  return "altro";
}

export const priceOpinionLabel: Record<PriceOpinion, string> = {
  basso: "Conveniente",
  giusto: "Giusto",
  alto: "Alto",
};

export const intentLabel: Record<VisitIntent, string> = {
  proposta: "Vuole fare una proposta",
  ci_pensa: "Ci pensa",
  altro_immobile: "Vuole vedere altro",
  non_interessato: "Non interessato",
};

/** Giorni alla scadenza (negativo se scaduto) */
export const daysTo = (iso: string) => Math.round((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
