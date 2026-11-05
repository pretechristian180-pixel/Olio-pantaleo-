import type { LLMObjectRequest, LLMObjectResponse, LLMProvider } from "./llm.js";

/**
 * Provider finto per test e sviluppo senza chiave API.
 * Restituisce, in ordine, le risposte passate (validate con lo schema come farebbe quello vero).
 */
export class FakeLLMProvider implements LLMProvider {
  readonly name = "fake";
  readonly calls: LLMObjectRequest<unknown>[] = [];

  constructor(private responses: ((req: LLMObjectRequest<unknown>) => unknown)[]) {}

  async generateObject<T>(request: LLMObjectRequest<T>): Promise<LLMObjectResponse<T>> {
    this.calls.push(request as LLMObjectRequest<unknown>);
    const next = this.responses.shift();
    if (!next) throw new Error("FakeLLMProvider: nessuna risposta preparata");
    const data = request.schema.parse(next(request as LLMObjectRequest<unknown>));
    return { data, model: "fake", cost: { provider: "fake", costUsd: 0 } };
  }
}
