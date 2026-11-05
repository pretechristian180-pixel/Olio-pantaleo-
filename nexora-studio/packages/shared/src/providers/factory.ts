import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./anthropic.js";
import type { LLMObjectRequest, LLMProvider } from "./llm.js";

const DEMO_TOPICS = [
  ["Il prodotto più richiesto", "Sai qual è la cosa che ci chiedono di più?", "product", ["prodotto", "più richiesto"]],
  ["Dietro le quinte della mattina", "Ecco cosa succede prima che apriamo", "behind_the_scenes", ["dietro le quinte", "mattina"]],
  ["L'errore che vediamo più spesso", "C'è un errore che fanno quasi tutti", "tutorial", ["errore comune", "consiglio"]],
  ["Perché abbiamo iniziato", "Ti racconto come è nato tutto", "talking_head", ["storia", "origini"]],
  ["La domanda di un cliente", "Un cliente ieri mi ha chiesto una cosa", "testimonial", ["domanda cliente", "faq"]],
  ["Come scegliere bene", "Tre cose da guardare prima di scegliere", "tutorial", ["scelta", "guida"]],
] as const;

/**
 * Provider dimostrativo: produce script plausibili senza chiamare l'AI.
 * Solo per sviluppo e test (LLM_PROVIDER=demo), mai in produzione.
 */
function demoProvider(): LLMProvider {
  let cursor = 0;
  const one = (company: string) => {
    const t = DEMO_TOPICS[cursor++ % DEMO_TOPICS.length]!;
    return {
      title: `${t[0]} (${cursor})`,
      format: t[2],
      hook: t[1],
      body: `Sono di ${company}.\n${t[1]}\nTe lo spiego in un minuto.\nPrima cosa: guarda qui.\nSeconda cosa: chiedi sempre.\nE adesso lo sai anche tu.`,
      call_to_action: "Salva il video e passa a trovarci.",
      shooting_notes: {
        location: "Nel punto più riconoscibile del locale",
        framing: "Telefono verticale all'altezza degli occhi, a un braccio di distanza",
        light: "Di fronte a una finestra, mai controluce",
        duration_seconds: 45,
        tips: ["Fai una prova prima di registrare", "Parla come parleresti a un cliente"],
      },
      topic_tags: [...t[3], `demo${cursor}`],
    };
  };
  const companyOf = (req: LLMObjectRequest<unknown>) =>
    /- Nome: (.+)/.exec(req.messages[0]?.content ?? "")?.[1] ?? "noi";
  const countOf = (req: LLMObjectRequest<unknown>) =>
    Number(/Scrivi (\d+) script/.exec(req.messages[0]?.content ?? "")?.[1] ?? 1);
  const respond = (req: LLMObjectRequest<unknown>) =>
    /Scrivi un solo script/.test(req.messages[0]?.content ?? "")
      ? { script: one(companyOf(req)) }
      : { scripts: Array.from({ length: countOf(req) }, () => one(companyOf(req))) };
  return {
    name: "demo",
    async generateObject(req) {
      const data = req.schema.parse(respond(req as LLMObjectRequest<unknown>));
      return { data, model: "demo", cost: { provider: "demo", costUsd: 0 } };
    },
  };
}

/** Sceglie il provider LLM dalla configurazione (LLM_PROVIDER, ANTHROPIC_API_KEY, ANTHROPIC_MODEL). */
export function createLLMProvider(env: Record<string, string | undefined> = process.env): LLMProvider {
  const kind = env.LLM_PROVIDER ?? "anthropic";
  if (kind === "demo") {
    if (env.NODE_ENV === "production" && env.ALLOW_DEMO_PROVIDERS !== "true") {
      throw new Error("LLM_PROVIDER=demo non è ammesso in produzione");
    }
    return demoProvider();
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY mancante");
  return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL });
}
