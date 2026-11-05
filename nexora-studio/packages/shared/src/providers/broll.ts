import type { ProviderCost } from "../domain.js";

export interface BrollRequest {
  /** Descrizione della scena in italiano o inglese. */
  prompt: string;
  durationS: number;
  aspectRatio: "9:16" | "16:9" | "1:1";
  /** `stock` non consuma crediti b-roll, `ai` sì. */
  source: "ai" | "stock";
}

export interface BrollClip {
  url: string;
  durationS: number;
  source: "ai" | "stock";
  /** Crediti b-roll del piano consumati da questa clip. */
  creditsUsed: number;
}

export interface BrollProvider {
  readonly name: string;
  generate(request: BrollRequest): Promise<{ clip: BrollClip; cost: ProviderCost }>;
}
