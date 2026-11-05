import { createHash } from "node:crypto";

/**
 * URL embed Bunny Stream con token firmato (Embed View Token Authentication).
 * token = SHA256_HEX(token_key + video_id + scadenza_unix)
 * Va calcolato SOLO lato server: la chiave non deve mai arrivare al browser.
 */
export function signedEmbedUrl(opts: {
  libraryId: string;
  videoId: string;
  tokenKey: string;
  /** Durata di validità in secondi (default 2 ore). */
  ttlSec?: number;
  /** Secondo da cui partire ("Riprendi"). */
  startAt?: number;
  now?: number;
}) {
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  const expires = now + (opts.ttlSec ?? 7200);
  const token = createHash("sha256")
    .update(opts.tokenKey + opts.videoId + expires)
    .digest("hex");
  const params = new URLSearchParams({
    token,
    expires: String(expires),
    autoplay: "false",
    preload: "true",
    responsive: "true",
  });
  if (opts.startAt && opts.startAt > 5) params.set("t", String(Math.floor(opts.startAt)));
  return {
    url: `https://iframe.mediadelivery.net/embed/${encodeURIComponent(opts.libraryId)}/${encodeURIComponent(opts.videoId)}?${params}`,
    expires,
  };
}

/**
 * Firma per il caricamento TUS diretto dal browser verso Bunny Stream.
 * signature = SHA256_HEX(library_id + api_key + scadenza_unix + video_id)
 * La chiave API resta sul server: al browser arriva solo la firma, valida fino a `expires`.
 */
export function tusUploadSignature(opts: {
  libraryId: string;
  apiKey: string;
  videoId: string;
  ttlSec?: number;
  now?: number;
}) {
  const expires = Math.floor((opts.now ?? Date.now()) / 1000) + (opts.ttlSec ?? 6 * 3600);
  const signature = createHash("sha256")
    .update(opts.libraryId + opts.apiKey + expires + opts.videoId)
    .digest("hex");
  return { signature, expires };
}
