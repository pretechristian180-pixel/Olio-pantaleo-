import { z } from "zod";

/**
 * edit_spec: la "timeline" di un montaggio, salvata in video_versions.edit_spec.
 * È il contratto tra la decisione (LLM + regole) e il render (FFmpeg): deterministica e ripetibile.
 */
export const EditSpecSchema = z.object({
  version: z.literal(1),
  /** Parti del girato da tenere, in ordine di riproduzione (secondi del girato originale). */
  segments: z.array(z.object({ start: z.number(), end: z.number() })).min(1),
  subtitles: z.object({
    enabled: z.boolean(),
    style: z.enum(["pulito", "evidenziato", "karaoke"]),
    size: z.enum(["piccoli", "medi", "grandi"]),
    /** Indici (nella trascrizione) delle parole da evidenziare col colore del brand. */
    highlightWordIndices: z.array(z.number().int()),
    /** Colore di evidenziazione #RRGGBB. */
    highlightColor: z.string(),
    font: z.string(),
  }),
  music: z
    .object({
      trackId: z.string(),
      /** Volume della musica sotto la voce (0..1, tipicamente 0.08-0.18). */
      volume: z.number(),
    })
    .nullable(),
  /** Testo grande nei primi secondi (la frase d'aggancio), facoltativo. */
  hookOverlay: z.string().nullable(),
  outroLogo: z.boolean(),
  /** Inquadratura: "cover" riempie 9:16 tagliando, "fit" mette il video su sfondo sfocato. */
  framing: z.enum(["cover", "fit"]),
  broll: z.array(
    z.object({
      /** Secondo del video montato in cui inserire la clip. */
      at: z.number(),
      duration: z.number(),
      query: z.string(),
      storagePath: z.string().nullable(),
    }),
  ),
});

export type EditSpec = z.infer<typeof EditSpecSchema>;
