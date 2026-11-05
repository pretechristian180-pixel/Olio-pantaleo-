import type { ProviderCost } from "../domain.js";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Se presente, il provider deve restituire JSON valido conforme a questo schema. */
  jsonSchema?: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  /** Output già interpretato quando è stato richiesto `jsonSchema`. */
  json?: unknown;
  cost: ProviderCost;
}

export interface LLMProvider {
  readonly name: string;
  complete(request: LLMRequest): Promise<LLMResponse>;
}
