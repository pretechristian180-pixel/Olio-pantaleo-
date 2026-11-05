"use client";

import { Upload } from "tus-js-client";

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

export interface ResumableUploadHandle {
  promise: Promise<string>;
  abort: () => void;
}

/**
 * Carica un file con il protocollo TUS di Supabase Storage.
 * Se la connessione cade riprova da solo, e se la pagina viene ricaricata riprende
 * dallo stesso punto (fingerprint salvato nel browser).
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
      chunkSize: CHUNK_SIZE,
      metadata: {
        bucketName: bucket,
        objectName,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (error) => reject(error),
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
