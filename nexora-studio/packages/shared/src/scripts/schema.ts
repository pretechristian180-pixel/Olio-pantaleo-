import { z } from "zod";

import { SCRIPT_FORMATS } from "../domain.js";

/**
 * Schema dell'output del modello per uno script.
 * Niente vincoli numerici o di lunghezza nello schema (non supportati dagli structured outputs):
 * li controlla `validateScript` dopo.
 */
export const ShootingNotesSchema = z.object({
  location: z.string().describe("Dove girare, concreto: es. 'davanti al forno, con le pizze in uscita'"),
  framing: z.string().describe("Inquadratura e posizione del telefono"),
  light: z.string().describe("Consiglio pratico sulla luce"),
  duration_seconds: z.number().int().describe("Durata consigliata del video in secondi"),
  tips: z.array(z.string()).describe("2-4 consigli pratici aggiuntivi"),
});

export const ScriptDraftSchema = z.object({
  title: z.string().describe("Titolo interno breve dello script (max 60 caratteri)"),
  format: z.enum(SCRIPT_FORMATS),
  hook: z.string().describe("Frase da dire nei primi 3 secondi, max 15 parole"),
  body: z.string().describe("Testo completo da dire in camera, parlato e naturale, a capo tra le frasi"),
  call_to_action: z.string().describe("Chiusura con invito all'azione, una frase"),
  shooting_notes: ShootingNotesSchema,
  topic_tags: z.array(z.string()).describe("2-4 parole chiave del tema, minuscole, per evitare ripetizioni"),
});

export const WeeklyScriptsSchema = z.object({
  scripts: z.array(ScriptDraftSchema),
});

export const SingleScriptSchema = z.object({ script: ScriptDraftSchema });

export type ScriptDraft = z.infer<typeof ScriptDraftSchema>;
export type ShootingNotes = z.infer<typeof ShootingNotesSchema>;
