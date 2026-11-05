/** Parola trascritta con tempi in secondi rispetto al girato originale. */
export interface Word {
  text: string;
  start: number;
  end: number;
}

export interface Transcript {
  language: string;
  text: string;
  words: Word[];
  durationS: number;
}

/** Intervallo del girato originale da tenere, in secondi. */
export interface Segment {
  start: number;
  end: number;
}

export interface SourceInfo {
  durationS: number;
  /** Dimensioni di visualizzazione (già ruotate secondo i metadati del telefono). */
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  orientation: "portrait" | "landscape" | "square";
}

/** Box di un volto, normalizzato 0..1 rispetto al frame. */
export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceSample {
  t: number;
  faces: FaceBox[];
}
