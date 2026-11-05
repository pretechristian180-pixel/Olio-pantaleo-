import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import type { ProviderCost } from "../domain.js";
import { LLMError, type LLMObjectRequest, type LLMObjectResponse, type LLMProvider } from "./llm.js";

/** Prezzi in USD per milione di token (input, output, lettura cache, scrittura cache 5 min). */
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function anthropicCost(model: string, usage: Usage): ProviderCost {
  const p = PRICING[model] ?? PRICING[DEFAULT_ANTHROPIC_MODEL]!;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const costUsd =
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      cacheRead * p.cacheRead +
      cacheWrite * p.cacheWrite) /
    1_000_000;
  return {
    provider: "anthropic",
    model,
    costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
    units: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
    },
  };
}

/**
 * LLMProvider su API Anthropic (Claude).
 * - Output strutturato validato con Zod (structured outputs).
 * - Prompt caching sul system prompt, che è stabile tra le aziende.
 * - Fallback lato server se il modello rifiuta la richiesta.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    this.model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
    this.client = new Anthropic({ apiKey: options.apiKey, maxRetries: 3, timeout: 5 * 60 * 1000 });
  }

  async generateObject<T>(request: LLMObjectRequest<T>): Promise<LLMObjectResponse<T>> {
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: request.maxTokens ?? 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: request.messages,
        output_config: {
          effort: request.effort ?? "medium",
          format: betaZodOutputFormat(request.schema),
        },
      });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
        throw new LLMError(`Anthropic temporaneamente non disponibile: ${error.status}`, "provider_error", true);
      }
      if (error instanceof Anthropic.APIConnectionError) {
        throw new LLMError("Connessione ad Anthropic non riuscita", "provider_error", true);
      }
      if (error instanceof Anthropic.APIError) {
        throw new LLMError(`Errore Anthropic ${error.status}`, "provider_error", false);
      }
      throw error;
    }

    const cost = anthropicCost(response.model, response.usage);

    if (response.stop_reason === "refusal") {
      throw new LLMError("Il modello ha rifiutato la richiesta", "refusal", false);
    }
    if (response.stop_reason === "max_tokens") {
      throw new LLMError("Risposta troncata (max_tokens)", "max_tokens", true);
    }
    const parsed = response.parsed_output;
    if (parsed == null) {
      throw new LLMError("Output non conforme allo schema", "invalid_output", true);
    }
    return { data: parsed as T, model: response.model, cost };
  }
}
