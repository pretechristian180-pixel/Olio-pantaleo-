import type { ProviderCost } from "../domain.js";

export interface TranscriptWord {
  text: string;
  /** Secondi dall'inizio del file. */
  start: number;
  end: number;
}

export interface Transcript {
  language: string;
  text: string;
  words: TranscriptWord[];
  durationS: number;
}

export interface TranscriptionInput {
  /** File audio locale (estratto dal girato dal worker). */
  filePath: string;
  durationS: number;
  language?: string;
  /** Testo atteso (lo script), usato solo dal provider dimostrativo. */
  hintText?: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(input: TranscriptionInput): Promise<{ transcript: Transcript; cost: ProviderCost }>;
}
