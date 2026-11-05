import type { ProviderCost } from "../domain.js";

export interface BrollRequest {
  /** Cosa mostrare, in inglese (le ricerche stock funzionano meglio). */
  query: string;
  durationS: number;
  aspectRatio: "9:16" | "16:9" | "1:1";
  /** `stock` non consuma crediti b-roll AI, `ai` sì. */
  source: "ai" | "stock";
  /** Clip già usate dall'azienda, da evitare. */
  excludeIds?: string[];
}

export interface BrollClip {
  /** Identificativo della clip presso il fornitore (per evitare ripetizioni). */
  id: string;
  /** URL da cui scaricare il file (o "demo:" per il provider dimostrativo). */
  downloadUrl: string;
  durationS: number;
  width: number;
  height: number;
  source: "ai" | "stock";
  /** Crediti b-roll AI del piano consumati da questa clip (0 per lo stock). */
  creditsUsed: number;
  /** Autore e pagina originale, per i crediti. */
  attribution?: { author: string; url: string };
}

export interface BrollProvider {
  readonly name: string;
  find(request: BrollRequest): Promise<{ clip: BrollClip | null; cost: ProviderCost }>;
}
