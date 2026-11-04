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
