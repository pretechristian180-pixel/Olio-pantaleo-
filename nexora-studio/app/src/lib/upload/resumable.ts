"use client";

import { type DetailedError, Upload } from "tus-js-client";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

/** Supabase richiede blocchi da esattamente 6 MB per l'upload riprendibile. */
const CHUNK_SIZE = 6 * 1024 * 1024;

export interface ResumableUploadOptions {
  bucket: "brand" | "raw";
  objectName: string;
  file: File;
  onProgress?: (percent: number) => void;
}

/** Errore di caricamento con lo stato HTTP (413 = file troppo grande per lo storage). */
export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/** Risposte che non cambiano riprovando: file troppo grande, tipo non ammesso, permessi, già esistente. */
const FINAL_STATUSES = new Set([400, 401, 403, 409, 413, 415]);

function statusOf(error: unknown): number | null {
  const res = (error as DetailedError | null)?.originalResponse;
  return res ? res.getStatus() : null;
}

export interface ResumableUploadHandle {
  promise: Promise<string>;
  abort: () => void;
}

/**
 * Carica un file con il protocollo TUS di Supabase Storage.
 * Se la connessione cade riprova da solo, e se si riprova con lo stesso percorso riprende
 * dallo stesso punto (fingerprint salvato nel browser). Gli errori definitivi (es. 413) non
 * vengono ritentati e arrivano come UploadError con lo stato HTTP.
 */
export async function startResumableUpload({
  bucket,
  objectName,
  file,
  onProgress,
}: ResumableUploadOptions): Promise<ResumableUploadHandle> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione scaduta: accedi di nuovo.");

  let upload: Upload | null = null;
  const promise = new Promise<string>((resolve, reject) => {
    upload = new Upload(file, {
      endpoint: `${publicEnv.supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 2000, 5000, 10000, 20000, 30000],
      headers: {
        authorization: `Bearer ${token}`,
        apikey: publicEnv.supabasePublishableKey,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      // La ripresa di un caricamento interrotto vale solo per lo stesso file nello stesso percorso:
      // così un file non finisce mai in un percorso diverso da quello registrato.
      fingerprint: async (f) => ["nexora", bucket, objectName, f.size, f.lastModified].join(":"),
      onShouldRetry: (error) => !FINAL_STATUSES.has(statusOf(error) ?? 0),
      chunkSize: CHUNK_SIZE,
      metadata: {
        bucketName: bucket,
        objectName,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (error) => reject(new UploadError(error.message, statusOf(error))),
      onProgress: (sent, total) => onProgress?.(total ? Math.round((sent / total) * 100) : 0),
      onSuccess: () => resolve(objectName),
    });

    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) upload!.resumeFromPreviousUpload(previous[0]);
        upload!.start();
      })
      .catch(reject);
  });

  return { promise, abort: () => void upload?.abort(true) };
}

/** Nome file sicuro per lo storage: niente spazi né caratteri strani. */
export function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext =
    dot > 0
      ? name
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      : "bin";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "file"}.${ext}`;
}
