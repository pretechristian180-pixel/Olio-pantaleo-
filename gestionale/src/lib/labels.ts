import type {
  AppointmentKind,
  Contract,
  DealStage,
  PropertyKind,
  PropertyStatus,
  Temperature,
} from "@/types/domain";

export type Tone = "blue" | "green" | "orange" | "red" | "gray" | "violet" | "teal" | "amber" | "sky";

export const statusLabel: Record<PropertyStatus, { label: string; tone: Tone }> = {
  disponibile: { label: "Disponibile", tone: "green" },
  trattativa: { label: "In trattativa", tone: "orange" },
  venduto: { label: "Venduto", tone: "gray" },
};

export const contractLabel: Record<Contract, string> = {
  vendita: "Vendita",
  affitto: "Affitto",
};

export const kindLabel: Record<PropertyKind, string> = {
  appartamento: "Appartamento",
  villa: "Villa",
  trullo: "Trullo",
  masseria: "Masseria",
  attico: "Attico",
  casa: "Casa indipendente",
};

export const temperatureLabel: Record<Temperature, { label: string; tone: Tone; hint: string }> = {
  // Il rosso è riservato agli errori: per la temperatura usiamo arancione, giallo e azzurro.
  caldo: { label: "Caldo", tone: "orange", hint: "Pronto a comprare" },
  tiepido: { label: "Tiepido", tone: "amber", hint: "Interessato, da seguire" },
  freddo: { label: "Freddo", tone: "sky", hint: "Si sta solo guardando intorno" },
};

export const stages: { id: DealStage; label: string }[] = [
  { id: "nuovo", label: "Nuovo contatto" },
  { id: "visita", label: "Visita fatta" },
  { id: "proposta", label: "Proposta" },
  { id: "compromesso", label: "Compromesso" },
  { id: "rogito", label: "Rogito" },
];

export const appointmentKind: Record<AppointmentKind, { label: string; tone: Tone }> = {
  visita: { label: "Visita", tone: "blue" },
  valutazione: { label: "Valutazione", tone: "violet" },
  firma: { label: "Firma", tone: "teal" },
};

/** Classi Tailwind per ogni tono (sfondo tenue + testo + pallino) */
export const toneClasses: Record<Tone, { soft: string; dot: string; bar: string }> = {
  blue: { soft: "bg-primary-soft text-primary", dot: "bg-primary", bar: "border-l-primary" },
  green: { soft: "bg-success-soft text-success", dot: "bg-success", bar: "border-l-success" },
  orange: { soft: "bg-warning-soft text-warning", dot: "bg-warning", bar: "border-l-warning" },
  red: { soft: "bg-destructive-soft text-destructive", dot: "bg-destructive", bar: "border-l-destructive" },
  gray: { soft: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", bar: "border-l-muted-foreground" },
  violet: { soft: "bg-violet-50 text-violet-700", dot: "bg-violet-600", bar: "border-l-violet-600" },
  teal: { soft: "bg-teal-50 text-teal-700", dot: "bg-teal-600", bar: "border-l-teal-600" },
  amber: { soft: "bg-amber-50 text-amber-700", dot: "bg-amber-500", bar: "border-l-amber-500" },
  sky: { soft: "bg-sky-50 text-sky-700", dot: "bg-sky-500", bar: "border-l-sky-500" },
};
