import { createTranscriptionProvider, type TranscriptionInput, type TranscriptionProvider } from "@nexora/shared/server";
import { transcribeLocal } from "@nexora/video-engine";

/** Costo stimato del calcolo sul worker per minuto di audio (USD), per il costo per video. */
const LOCAL_USD_PER_MIN = Number(process.env.LOCAL_TRANSCRIBE_USD_PER_MIN ?? "0.002");

/** Whisper sul worker (faster-whisper): nessun servizio esterno, l'audio resta sul server. */
export class LocalWhisperTranscriber implements TranscriptionProvider {
  readonly name = "local-whisper";

  async transcribe(input: TranscriptionInput) {
    const started = Date.now();
    const model = process.env.WHISPER_MODEL_SIZE ?? "large-v3-turbo";
    const res = await transcribeLocal(input.filePath, { language: input.language ?? "it", model, prompt: input.hintText });
    const durationS = res.durationS || input.durationS;
    return {
      transcript: { language: res.language || "it", text: res.text, words: res.words, durationS },
      cost: {
        provider: "local-whisper",
        model,
        costUsd: Math.round((durationS / 60) * LOCAL_USD_PER_MIN * 1_000_000) / 1_000_000,
        units: { audio_seconds: Math.round(durationS), ms: Date.now() - started },
      },
    };
  }
}

/**
 * Trascrizione: TRANSCRIPTION_PROVIDER=local (predefinito senza chiave OpenAI), whisper (API
 * OpenAI) o demo (solo test).
 */
export function createWorkerTranscriber(env: Record<string, string | undefined> = process.env): TranscriptionProvider {
  const kind = env.TRANSCRIPTION_PROVIDER ?? (env.OPENAI_API_KEY ? "whisper" : "local");
  return kind === "local" ? new LocalWhisperTranscriber() : createTranscriptionProvider(env);
}
