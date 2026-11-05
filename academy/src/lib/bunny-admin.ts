import "server-only";
import { tusUploadSignature } from "@/lib/bunny";

const API = "https://video.bunnycdn.com";

function config() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) return null;
  return { libraryId, apiKey };
}

export function isBunnyConfigured() {
  return config() !== null;
}

/** Crea il video vuoto su Bunny e restituisce i dati per caricarlo dal browser. */
export async function createBunnyUpload(title: string, collectionId?: string) {
  const c = config();
  if (!c) throw new Error("Bunny Stream non è configurato");
  const res = await fetch(`${API}/library/${encodeURIComponent(c.libraryId)}/videos`, {
    method: "POST",
    headers: {
      AccessKey: c.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ title: title.slice(0, 200), ...(collectionId ? { collectionId } : {}) }),
  });
  if (!res.ok) throw new Error(`Bunny ha rifiutato la creazione del video (${res.status})`);
  const video = (await res.json()) as { guid: string };
  const { signature, expires } = tusUploadSignature({
    libraryId: c.libraryId,
    apiKey: c.apiKey,
    videoId: video.guid,
  });
  return {
    videoId: video.guid,
    libraryId: c.libraryId,
    signature,
    expires,
    endpoint: `${API}/tusupload`,
  };
}

/** Stato di elaborazione e durata (secondi) di un video. */
export async function getBunnyVideo(videoId: string) {
  const c = config();
  if (!c) throw new Error("Bunny Stream non è configurato");
  const res = await fetch(
    `${API}/library/${encodeURIComponent(c.libraryId)}/videos/${encodeURIComponent(videoId)}`,
    { headers: { AccessKey: c.apiKey, Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Video non trovato su Bunny (${res.status})`);
  const v = (await res.json()) as { status: number; length: number; encodeProgress?: number };
  return {
    status: v.status,
    durataSec: Math.round(v.length ?? 0),
    progress: v.encodeProgress ?? 0,
  };
}

export async function deleteBunnyVideo(videoId: string) {
  const c = config();
  if (!c) return;
  await fetch(
    `${API}/library/${encodeURIComponent(c.libraryId)}/videos/${encodeURIComponent(videoId)}`,
    {
      method: "DELETE",
      headers: { AccessKey: c.apiKey },
    },
  ).catch(() => {});
}
