/** Funzioni di un'academy: quelle del piano, con le eccezioni decise dal super-admin. Logica pura, testata. */

export type Features = {
  landing_ia: boolean;
  max_landing_ai_mese: number | null;
  max_sezioni_ai_mese: number | null;
  max_ore_video: number | null;
  max_studenti_attivi: number | null;
  max_staff: number | null;
  dominio_personalizzato: boolean;
  senza_marchio_nexora: boolean;
  abbonamenti_studenti: boolean;
};

export type FeatureKey = keyof Features;

/** Voci mostrate nel pannello, nell'ordine. "numero": vuoto = illimitato. */
export const FEATURE_FIELDS: {
  key: FeatureKey;
  label: string;
  tipo: "si_no" | "numero";
  unita?: string;
}[] = [
  { key: "landing_ia", label: "Landing di vendita con l'IA", tipo: "si_no" },
  { key: "max_landing_ai_mese", label: "Landing IA al mese", tipo: "numero" },
  { key: "max_sezioni_ai_mese", label: "Riscritture di sezione IA al mese", tipo: "numero" },
  { key: "max_ore_video", label: "Ore di video", tipo: "numero", unita: "ore" },
  { key: "max_studenti_attivi", label: "Studenti attivi al mese", tipo: "numero" },
  { key: "max_staff", label: "Persone del team", tipo: "numero" },
  { key: "dominio_personalizzato", label: "Dominio personalizzato", tipo: "si_no" },
  { key: "senza_marchio_nexora", label: "Senza «Creato con Nexora Academy»", tipo: "si_no" },
  {
    key: "abbonamenti_studenti",
    label: "Abbonamenti e accessi aziendali per gli studenti",
    tipo: "si_no",
  },
];

export type PlanFeatures = Omit<Features, "landing_ia"> & { codice?: string };

const intOrNull = (v: unknown) =>
  v === null
    ? null
    : typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1_000_000
      ? v
      : undefined;

/** Tiene solo le eccezioni valide (chiavi note, tipi giusti): il resto viene ignorato. */
export function parseOverrides(raw: unknown): Partial<Features> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Features> = {};
  for (const f of FEATURE_FIELDS) {
    if (!(f.key in raw)) continue;
    const v = (raw as Record<string, unknown>)[f.key];
    if (f.tipo === "si_no") {
      if (typeof v === "boolean") (out as Record<string, unknown>)[f.key] = v;
    } else {
      const n = intOrNull(v);
      if (n !== undefined) (out as Record<string, unknown>)[f.key] = n;
    }
  }
  return out;
}

/** Funzioni effettive: piano + eccezioni. Senza piano: le più prudenti. */
export function effectiveFeatures(
  plan: Partial<PlanFeatures> | null,
  overrides: unknown,
): Features {
  const base: Features = {
    landing_ia: true,
    max_landing_ai_mese: plan?.max_landing_ai_mese ?? 0,
    max_sezioni_ai_mese: plan ? (plan.max_sezioni_ai_mese ?? null) : 0,
    max_ore_video: plan ? (plan.max_ore_video ?? null) : 0,
    max_studenti_attivi: plan ? (plan.max_studenti_attivi ?? null) : 0,
    max_staff: plan ? (plan.max_staff ?? null) : 1,
    dominio_personalizzato: plan?.dominio_personalizzato ?? false,
    senza_marchio_nexora: plan?.senza_marchio_nexora ?? false,
    abbonamenti_studenti: plan?.abbonamenti_studenti ?? false,
  };
  return { ...base, ...parseOverrides(overrides) };
}

/** Dal modulo del pannello alle sole eccezioni rispetto al piano (così cambiare piano resta semplice). */
export function overridesFromForm(
  form: FormData,
  plan: Partial<PlanFeatures> | null,
): Partial<Features> {
  const base = effectiveFeatures(plan, {});
  const out: Record<string, unknown> = {};
  for (const f of FEATURE_FIELDS) {
    let v: boolean | number | null;
    if (f.tipo === "si_no") v = form.get(`f_${f.key}`) === "on";
    else {
      const s = String(form.get(`f_${f.key}`) ?? "").trim();
      const n = Number(s);
      v = s === "" ? null : Number.isInteger(n) && n >= 0 ? Math.min(n, 1_000_000) : null;
    }
    if (v !== base[f.key]) out[f.key] = v;
  }
  return out as Partial<Features>;
}

/** L'omaggio è scaduto? (senza data di fine non scade mai) */
export function omaggioScaduto(omaggio: boolean, fineIl: string | null, now = Date.now()) {
  return omaggio && fineIl !== null && new Date(fineIl).getTime() < now;
}

export function describeLimit(v: number | null, unita = "") {
  return v === null ? "Illimitato" : `${v.toLocaleString("it-IT")}${unita ? ` ${unita}` : ""}`;
}
