import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

import type { AdminDb } from "@nexora/shared/server";

type Bucket = "raw" | "output" | "brand" | "music";

/** Scarica un file dello storage su disco in streaming (i girati possono pesare 2 GB). */
export async function downloadToFile(db: AdminDb, bucket: Bucket, path: string, dest: string) {
  try {
    const s = await stat(dest);
    if (s.size > 0) return dest; // già in cache sul worker
  } catch {
    // non in cache
  }
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 60 * 30);
  if (error || !data) throw new Error(`Link al file non creato (${bucket}): ${error?.message}`);
  const res = await fetch(data.signedUrl);
  if (!res.ok || !res.body) throw new Error(`Download non riuscito (${bucket}): ${res.status}`);
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body as WebReadableStream), createWriteStream(dest));
  return dest;
}

export async function uploadFile(db: AdminDb, bucket: Bucket, path: string, file: string, contentType: string) {
  const body = await readFile(file);
  const { error } = await db.storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Caricamento non riuscito (${bucket}/${path}): ${error.message}`);
}
