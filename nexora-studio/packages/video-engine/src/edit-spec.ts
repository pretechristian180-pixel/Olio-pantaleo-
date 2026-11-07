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
    /**
     * Correzioni del testo dei sottotitoli (errori di trascrizione): le parole from..to
     * (indici inclusivi della trascrizione) vengono mostrate come `text`. I tempi restano quelli audio.
     */
    fixes: z
      .array(z.object({ from: z.number().int(), to: z.number().int(), text: z.string() }))
      .default([]),
    /** Zona preferita: "auto" = in basso evitando i volti (comportamento predefinito). */
    position: z.enum(["auto", "alto", "centro", "basso"]).default("auto"),
    /** Tutto maiuscolo (stile di molti reel). */
    uppercase: z.boolean().default(false),
    /**
     * Parola chiave ripetuta in grande vicino al sottotitolo, in maiuscolo con effetto neon nel
     * colore del brand (una per blocco, tra le parole evidenziate).
     */
    keywordEmphasis: z.boolean().default(false),
    /** Colore dell'alone della parola chiave (#RRGGBB); se manca, quello di evidenziazione. */
    keywordColor: z.string().nullable().default(null),
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
  /** Logo del brand fisso in un angolo per tutto il video (non sulla chiusura). */
  logoWatermark: z.enum(["nessuno", "alto", "alto-sinistra", "alto-destra"]).default("nessuno"),
  /** Zoom leggero alternato sui tagli (stile reel): nasconde i salti e dà ritmo. */
  punchIn: z.boolean().default(true),
  /** Pulizia della voce del telefono: taglio dei bassi rimbombanti e riduzione del rumore di fondo. */
  voiceCleanup: z.boolean().default(true),
  /** Inquadratura: "cover" riempie 9:16 tagliando, "fit" mette il video su sfondo sfocato. */
  framing: z.enum(["cover", "fit"]),
  broll: z.array(
    z.object({
      /** Secondo del video montato in cui inserire la clip. */
      at: z.number(),
      duration: z.number(),
      query: z.string(),
      storagePath: z.string().nullable(),
      /** "output": clip di repertorio salvata accanto al video; "raw": clip di copertura del cliente. */
      bucket: z.enum(["output", "raw"]).default("output"),
    }),
  ),
});

export type EditSpec = z.infer<typeof EditSpecSchema>;
