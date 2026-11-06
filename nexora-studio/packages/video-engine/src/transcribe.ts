import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { execCommand } from "./exec.js";

const here = dirname(fileURLToPath(import.meta.url));
const TRANSCRIBE_PY = join(here, "..", "python", "transcribe.py");

export interface LocalTranscript {
  language: string;
  text: string;
  durationS: number;
  words: { text: string; start: number; end: number }[];
}

/**
 * Trascrizione parola per parola con Whisper eseguito sul worker (faster-whisper su CPU):
 * l'audio non lascia il server. Il modello è già nell'immagine (WHISPER_MODELS_DIR).
 */
export async function transcribeLocal(
  audioPath: string,
  opts: {
    language?: string;
    model?: string;
    modelsDir?: string;
    python?: string;
    timeoutMs?: number;
    /** Testo atteso (lo script): migliora la trascrizione di nomi e parole del settore. */
    prompt?: string;
  } = {},
): Promise<LocalTranscript> {
  let promptFile = "";
  if (opts.prompt?.trim()) {
    promptFile = `${audioPath}.prompt.txt`;
    await writeFile(promptFile, opts.prompt, "utf8");
  }
  const out = await execCommand(
    opts.python ?? process.env.PYTHON_BIN ?? "python3",
    [
      TRANSCRIBE_PY,
      audioPath,
      opts.language ?? "it",
      opts.model ?? process.env.WHISPER_MODEL_SIZE ?? "large-v3-turbo",
      opts.modelsDir ?? process.env.WHISPER_MODELS_DIR ?? "",
      promptFile,
    ],
    { timeoutMs: opts.timeoutMs ?? 20 * 60_000 },
  );
  const parsed = JSON.parse(out) as { language: string; text: string; duration: number; words: LocalTranscript["words"] };
  return { language: parsed.language, text: parsed.text, durationS: parsed.duration, words: parsed.words };
}
