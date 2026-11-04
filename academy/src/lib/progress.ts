/** Regole dell'avanzamento, condivise da API e interfaccia. */

/** Oltre questa quota la lezione è considerata completata. */
export const COMPLETION_RATIO = 0.9;
/** Il player manda un aggiornamento ogni ~10 s: oltre questo scarto non contiamo i secondi (salti, schede in background). */
export const MAX_HEARTBEAT_SEC = 15;

export type ProgressInput = {
  secondo: number;
  /** Secondi effettivamente guardati dall'ultimo invio. */
  delta: number;
  durataSec: number;
};

export type ProgressRow = {
  ultimo_secondo: number;
  secondi_visti: number;
  completata: boolean;
};

export function nextProgress(prev: ProgressRow | null, input: ProgressInput): ProgressRow {
  const durata = Math.max(0, Math.floor(input.durataSec));
  const secondo = Math.max(
    0,
    Math.floor(durata > 0 ? Math.min(input.secondo, durata) : input.secondo),
  );
  const delta = Math.min(MAX_HEARTBEAT_SEC, Math.max(0, Math.floor(input.delta)));
  const completata =
    (prev?.completata ?? false) || (durata > 0 && secondo >= Math.floor(durata * COMPLETION_RATIO));
  return {
    // A lezione finita "Riprendi" riparte dall'inizio.
    ultimo_secondo: durata > 0 && secondo >= durata - 5 ? 0 : secondo,
    secondi_visti: (prev?.secondi_visti ?? 0) + delta,
    completata,
  };
}

/** Prima lezione non completata nell'ordine del corso (o la prima, se sono tutte fatte). */
export function nextLessonToWatch<T extends { id: string }>(lessons: T[], completed: Set<string>) {
  return lessons.find((l) => !completed.has(l.id)) ?? lessons[0] ?? null;
}
