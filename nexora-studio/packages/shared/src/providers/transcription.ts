import type { ProviderCost } from "../domain.js";

export interface TranscriptWord {
  text: string;
  /** Secondi dall'inizio del file. */
  start: number;
  end: number;
  confidence?: number;
}

export interface Transcript {
  language: string;
  text: string;
  words: TranscriptWord[];
  durationS: number;
}

export interface TranscriptionInput {
  /** URL firmato e temporaneo del file audio/video. */
  mediaUrl: string;
  language?: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(input: TranscriptionInput): Promise<{ transcript: Transcript; cost: ProviderCost }>;
}
