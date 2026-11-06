"use client";

import { registerUpload } from "@/lib/actions/videos";
import { safeFileName, startResumableUpload, UploadError } from "@/lib/upload/resumable";

const objectNames = new WeakMap<File, string>();

/**
 * Carica un girato (riprendibile) e lo registra: parte la lavorazione.
 * Restituisce l'id del video oppure un messaggio d'errore già pronto per l'utente.
 */
export async function submitVideo({
  workspaceId,
  file,
  scriptId,
  onProgress,
  onAbortReady,
}: {
  workspaceId: string;
  file: File;
  scriptId: string | null;
  onProgress?: (percent: number) => void;
  onAbortReady?: (abort: () => void) => void;
}): Promise<{ videoId?: string; error?: string }> {
  // Stesso file, stesso percorso: un nuovo tentativo riprende da dove era arrivato.
  let objectName = objectNames.get(file);
  if (!objectName?.startsWith(`${workspaceId}/`)) {
    objectName = `${workspaceId}/${crypto.randomUUID()}/${safeFileName(file.name)}`;
    objectNames.set(file, objectName);
  }
  try {
    const handle = await startResumableUpload({ bucket: "raw", objectName, file, onProgress });
    onAbortReady?.(handle.abort);
    await handle.promise;
  } catch (e) {
    if (e instanceof UploadError && e.status === 413) {
      return { error: "Il video è troppo grande per essere caricato. Registrane uno più breve." };
    }
    return {
      error:
        "Il caricamento si è interrotto. Controlla la connessione e riprova: ripartirà da dove era arrivato.",
    };
  }
  const res = await registerUpload({
    workspaceId,
    storagePath: objectName,
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type || "video/mp4",
    scriptId,
  });
  if (res.error || !res.videoId) return { error: res.error ?? "Qualcosa è andato storto." };
  return { videoId: res.videoId };
}
