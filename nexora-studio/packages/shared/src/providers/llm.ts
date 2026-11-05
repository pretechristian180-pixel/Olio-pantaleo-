import type { z } from "zod";

import type { ProviderCost } from "../domain.js";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMObjectRequest<T> {
  /** Parte stabile del prompt: viene messa in cache dal provider quando possibile. */
  system: string;
  messages: LLMMessage[];
  /** Schema dell'output: il provider deve restituire JSON valido e conforme. */
  schema: z.ZodType<T>;
  /** Livello di ragionamento: più alto = più qualità, più costo e latenza. */
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export interface LLMObjectResponse<T> {
  data: T;
  model: string;
  cost: ProviderCost;
}

/** Errore che non ha senso ritentare (rifiuto del modello, output non valido dopo i tentativi). */
export class LLMError extends Error {
  constructor(
    message: string,
    readonly code: "refusal" | "invalid_output" | "max_tokens" | "provider_error",
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export interface LLMProvider {
  readonly name: string;
  generateObject<T>(request: LLMObjectRequest<T>): Promise<LLMObjectResponse<T>>;
}
