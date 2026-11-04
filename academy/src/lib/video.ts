import "server-only";
import { signedEmbedUrl } from "@/lib/bunny";

/** URL embed firmato, o null se Bunny non è ancora configurato o la lezione non ha video. */
export function embedForLesson(videoId: string | null, startAt = 0) {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const tokenKey = process.env.BUNNY_STREAM_TOKEN_KEY;
  if (!videoId || !libraryId || !tokenKey) return null;
  return signedEmbedUrl({ libraryId, videoId, tokenKey, ttlSec: 7200, startAt });
}
