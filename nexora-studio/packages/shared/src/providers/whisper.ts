import { createReadStream } from "node:fs";

import OpenAI from "openai";

import { LLMError } from "./llm.js";
import type { TranscriptionInput, TranscriptionProvider } from "./transcription.js";

/** USD al minuto di audio (whisper-1). */
const WHISPER_USD_PER_MIN = 0.006;

/** Trascrizione parola per parola con Whisper (API OpenAI). */
export class WhisperProvider implements TranscriptionProvider {
  readonly name = "openai-whisper";
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model = "whisper-1",
  ) {
    this.client = new OpenAI({ apiKey, maxRetries: 3, timeout: 10 * 60 * 1000 });
  }

  async transcribe(input: TranscriptionInput) {
    let res;
    try {
      res = await this.client.audio.transcriptions.create({
        file: createReadStream(input.filePath),
        model: this.model,
        language: input.language ?? "it",
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
      });
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        const retryable = error.status === 429 || (error.status ?? 500) >= 500;
        throw new LLMError(`Whisper: errore ${error.status}`, "provider_error", retryable);
      }
      throw new LLMError("Whisper: connessione non riuscita", "provider_error", true);
    }
    const words = (res.words ?? []).map((w) => ({ text: w.word.trim(), start: w.start, end: w.end }));
    const durationS = res.duration ?? input.durationS;
    return {
      transcript: { language: res.language ?? "it", text: res.text, words, durationS },
      cost: {
        provider: "openai",
        model: this.model,
        costUsd: Math.round(((durationS / 60) * WHISPER_USD_PER_MIN) * 1_000_000) / 1_000_000,
        units: { audio_seconds: Math.round(durationS) },
      },
    };
  }
}

/**
 * Trascrizione dimostrativa (sviluppo e test, nessuna chiamata esterna): distribuisce il testo
 * atteso sulla durata del girato, con una pausa lunga a metà e un "errore" ripetuto da tagliare.
 */
export class DemoTranscriber implements TranscriptionProvider {
  readonly name = "demo";

  async transcribe(input: TranscriptionInput) {
    const base = (input.hintText ?? "Ciao, questo è un video di prova montato in automatico da Nexora Studio.")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ");
    const usable = Math.max(1, input.durationS - 1);
    const step = Math.min(0.5, usable / (base.length + 6));
    const words = [];
    let t = 0.4;
    for (let i = 0; i < base.length; i++) {
      if (i === Math.floor(base.length / 2)) t += 1.6; // pausa lunga da tagliare
      words.push({ text: base[i]!, start: t, end: t + step * 0.8 });
      t += step;
      if (t > input.durationS - 0.3) break;
    }
    return {
      transcript: { language: "it", text: words.map((w) => w.text).join(" "), words, durationS: input.durationS },
      cost: { provider: "demo", costUsd: 0 },
    };
  }
}

export function createTranscriptionProvider(env: Record<string, string | undefined> = process.env): TranscriptionProvider {
  const kind = env.TRANSCRIPTION_PROVIDER ?? "whisper";
  if (kind === "demo") {
    if (env.NODE_ENV === "production" && env.ALLOW_DEMO_PROVIDERS !== "true") {
      throw new Error("TRANSCRIPTION_PROVIDER=demo non è ammesso in produzione");
    }
    return new DemoTranscriber();
  }
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY mancante");
  return new WhisperProvider(env.OPENAI_API_KEY, env.WHISPER_MODEL ?? "whisper-1");
}
