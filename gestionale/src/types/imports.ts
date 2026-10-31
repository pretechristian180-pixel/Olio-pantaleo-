import type { ImportType } from "@/features/import/fields";

export type { ImportType };
export type DuplicateOption = "salta" | "aggiorna" | "crea";
export type ImportState = "caricato" | "mappatura" | "anteprima" | "in_corso" | "completato" | "annullato" | "errore";

export interface ImportJob {
  id: string;
  type: ImportType;
  fileName: string;
  state: ImportState;
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  discarded: number;
  mapping: Record<string, string>;
  duplicates: DuplicateOption;
  createdAt: string;
  completedAt: string | null;
}

export interface PreviewRow {
  number: number;
  data: Record<string, unknown>;
  note: string | null;
  error: string | null;
  duplicate: boolean;
  warnings: string[];
}

export interface ImportPreview {
  total: number;
  valid: number;
  duplicates: number;
  errors: number;
  rows: PreviewRow[];
}

/** Riga non importata, con le colonne originali e il motivo */
export interface DiscardedRow {
  number: number;
  original: Record<string, string>;
  reason: string;
}
