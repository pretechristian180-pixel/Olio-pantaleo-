import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./anthropic.js";
import { type LLMObjectRequest, type LLMProvider, messageText } from "./llm.js";

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
    /- Nome: (.+)/.exec(messageText(req.messages[0]?.content ?? ""))?.[1] ?? "noi";
  const countOf = (req: LLMObjectRequest<unknown>) =>
    Number(/Scrivi (\d+) script/.exec(messageText(req.messages[0]?.content ?? ""))?.[1] ?? 1);
  const editPlan = (req: LLMObjectRequest<unknown>) => {
    const content = messageText(req.messages[0]?.content ?? "");
    const total = Number(/PAROLE TOTALI: (\d+)/.exec(content)?.[1] ?? 0);
    const feedback = /RICHIESTA DI MODIFICA DEL CLIENTE\n([^\n]+)/.exec(content)?.[1]?.toLowerCase() ?? "";
    const dropFirst = /(togli|taglia).*(inizi|prima)/.test(feedback);
    return {
      keep: total ? [{ from_word: dropFirst ? Math.min(3, total - 1) : 0, to_word: total - 1 }] : [],
      subtitle_fixes: [],
      subtitle_position: /sottotitoli in alto/.test(content.toLowerCase()) ? "alto" : null,
      subtitle_uppercase: /maiuscol/.test(content.toLowerCase()) ? true : null,
      subtitles_enabled: null,
      punch_in: /senza zoom|niente zoom/.test(content.toLowerCase()) ? false : null,
      pause_trim: /ritmo veloce|serrat/.test(content.toLowerCase()) ? "stretto" : null,
      highlight_words: Array.from({ length: Math.floor(total / 5) }, (_, i) => i * 5 + 2).filter((i) => i < total),
      hook_overlay: "Guarda fino alla fine",
      music_mood: "energica",
      subtitle_size: /pi[uù] grand/.test(feedback) ? "grandi" : null,
      subtitle_style: null,
      music_volume: /musica.*(bassa|pi[uù] piano)/.test(feedback) ? "bassa" : null,
      broll: [
        ...(total > 20 ? [{ at_word: Math.floor(total * 0.45), duration_s: 3, own_clip: null, query_en: "small business owner" }] : []),
        // Clip di copertura del cliente: la prima a un quarto del video
        ...(/CLIP DI COPERTURA DEL CLIENTE/.test(content) && total > 8
          ? [{ at_word: Math.floor(total * 0.25), duration_s: 3, own_clip: 1, query_en: "" }]
          : []),
      ],
      caption: `Un minuto con ${companyOf(req)}: salva il video e passa a trovarci!`,
      hashtags: ["video", "pmi", "italia", "dietrolequinte", "consigli"],
      notes: dropFirst ? "Tolte le prime parole su richiesta del cliente." : "Tolte le pause lunghe.",
    };
  };
  // Ordine delle riprese: dove compaiono le loro prime parole nello script (senza script: come caricate).
  const clipOrder = (content: string) => {
    const norm = (t: string) => t.toLowerCase().replace(/[^a-zà-ù0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const script = norm(/- Testo: (.+)/.exec(content)?.[1] ?? "");
    const clips = [...content.matchAll(/- Ripresa (\d+) \([^)]*\): (.*)/g)].map((m) => {
      const head = norm(m[2] ?? "").split(" ").slice(0, 3).join(" ");
      const at = head && script ? script.indexOf(head) : -1;
      return { n: Number(m[1]), at: at < 0 ? Number.MAX_SAFE_INTEGER : at };
    });
    return { order: clips.sort((a, b) => a.at - b.at || a.n - b.n).map((c) => c.n), notes: "Ordine dello script." };
  };
  // Stile di riferimento: senza vedere i fotogrammi, deduce lo stile dal ritmo misurato.
  const styleAnalysis = (content: string) => {
    const perMinute = Number(/\((\d+(?:\.\d+)?) al minuto/.exec(content)?.[1] ?? 0);
    const fast = perMinute >= 18;
    return {
      subtitles: {
        present: true,
        position: fast ? "centro" : "basso",
        size: fast ? "grandi" : "medi",
        uppercase: fast,
        highlight: fast ? "karaoke" : "parola colorata",
        words_per_block: fast ? 2 : 4,
      },
      hook_text: fast,
      text_overlays: false,
      zoom: fast ? "frequente" : "nessuno",
      broll: "poco",
      framing: "primo piano",
      energy: fast ? "energico" : "calmo",
      description: fast ? "Montaggio serrato, sottotitoli grandi in maiuscolo." : "Montaggio calmo, sottotitoli puliti in basso.",
    };
  };
  const respond = (req: LLMObjectRequest<unknown>) => {
    const content = messageText(req.messages[0]?.content ?? "");
    if (/^RIPRESE \(|\nRIPRESE \(/.test(content)) return clipOrder(content);
    if (/ANALISI DELLO STILE DI RIFERIMENTO/.test(content)) return styleAnalysis(content);
    if (/PAROLE TOTALI:/.test(content)) return editPlan(req);
    return /Scrivi un solo script/.test(content)
      ? { script: one(companyOf(req)) }
      : { scripts: Array.from({ length: countOf(req) }, () => one(companyOf(req))) };
  };
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
