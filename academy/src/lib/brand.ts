/** Marchio di ogni academy: colori validati, contrasto garantito, logo. Logica pura, testata. */

export type Brand = {
  primary: string;
  primaryDeep: string;
  /** Accento chiaro per testi e dettagli su fondo scuro. */
  primaryBright: string;
  dark: string;
  logoText: string;
  logoUrl: string | null;
  tagline: string | null;
};

export const DEFAULT_BRAND: Brand = {
  primary: "#2b62e8",
  primaryDeep: "#1d3fb8",
  primaryBright: "#45d9ff",
  dark: "#0b1124",
  logoText: "CHRISTIAN PRETE",
  logoUrl: null,
  tagline: null,
};

const HEX = /^#([0-9a-f]{6})$/i;

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapporto di contrasto WCAG tra due colori #rrggbb. */
export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Schiarisce un colore verso il bianco di una quota (0-1). */
export function lighten(hex: string, amount: number) {
  const [r, g, b] = rgb(hex).map((v) => Math.min(255, Math.round(v + (255 - v) * amount)));
  return `#${[r, g, b].map((v) => v!.toString(16).padStart(2, "0")).join("")}`;
}

/** Accento leggibile sul fondo scuro (almeno 4.5:1), partendo dal colore del cliente. */
export function brightOn(dark: string, primary: string) {
  let c = primary.toLowerCase();
  for (let i = 0; i < 20 && contrast(c, dark) < 4.5; i++) c = lighten(c, 0.12);
  return c;
}

/** Scurisce un colore di una quota (0-1). */
export function darken(hex: string, amount: number) {
  const [r, g, b] = rgb(hex).map((v) => Math.max(0, Math.round(v * (1 - amount))));
  return `#${[r, g, b].map((v) => v!.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Il colore principale fa da sfondo ai pulsanti con testo bianco: deve reggere 4.5:1.
 * Se il cliente sceglie un colore troppo chiaro lo scuriamo finché è leggibile.
 */
export function readablePrimary(hex: string) {
  let c = hex.toLowerCase();
  for (let i = 0; i < 20 && contrast(c, "#ffffff") < 4.5; i++) c = darken(c, 0.08);
  return c;
}

export function parseBrand(raw: unknown): Brand {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const primaryRaw =
    typeof b.primary === "string" && HEX.test(b.primary) ? b.primary : DEFAULT_BRAND.primary;
  const primary = readablePrimary(primaryRaw);
  const darkRaw =
    typeof b.dark === "string" && HEX.test(b.dark) ? b.dark.toLowerCase() : DEFAULT_BRAND.dark;
  // Il fondo scuro deve reggere il testo bianco.
  const dark = contrast(darkRaw, "#ffffff") >= 7 ? darkRaw : DEFAULT_BRAND.dark;
  const logoUrl = str(b.logo_url, 500);
  return {
    primary,
    primaryDeep:
      primary === DEFAULT_BRAND.primary ? DEFAULT_BRAND.primaryDeep : darken(primary, 0.3),
    primaryBright:
      primary === DEFAULT_BRAND.primary ? DEFAULT_BRAND.primaryBright : brightOn(dark, primary),
    dark,
    logoText: str(b.logo_text, 24)?.toUpperCase() ?? DEFAULT_BRAND.logoText,
    logoUrl: logoUrl && /^https:\/\//.test(logoUrl) ? logoUrl : null,
    tagline: str(b.tagline, 120),
  };
}

/** CSS che sovrascrive i token del design system per questa academy. */
export function brandCss(brand: Brand) {
  return `:root{--color-nexora-blue:${brand.primary};--color-nexora-blue-deep:${brand.primaryDeep};--color-nexora-blue-bright:${brand.primaryBright};--color-graphite-deep:${brand.dark}}`;
}
