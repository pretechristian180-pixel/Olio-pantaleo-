"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";
import { setCourseCover } from "@/app/admin/corsi/actions";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function CoverUpload({
  courseId,
  tenantId,
  url,
}: {
  courseId: string;
  tenantId: string;
  url: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError("Usa un'immagine JPG, PNG, WebP o AVIF.");
    if (file.size > MAX) return setError("L'immagine supera i 5 MB: riducila e riprova.");
    setError(undefined);
    start(async () => {
      const ext =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${tenantId}/${courseId}/copertina-${Date.now()}.${ext}`;
      const { error: up } = await createClient()
        .storage.from("copertine")
        .upload(path, file, { contentType: file.type });
      if (up) return setError("Caricamento non riuscito. Riprova.");
      const res = await setCourseCover(courseId, path);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg bg-graphite">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Copertina attuale del corso"
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-white/70">
            Nessuna copertina
          </div>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept={TYPES.join(",")}
          className="sr-only"
          id="copertina"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
          <ImageUp aria-hidden />{" "}
          {pending ? "Caricamento…" : url ? "Cambia copertina" : "Carica copertina"}
        </Button>
        {url && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await setCourseCover(courseId, null);
                router.refresh();
              })
            }
          >
            <Trash2 aria-hidden /> Rimuovi
          </Button>
        )}
      </div>
      <p className="text-[13px] text-ink-muted">Formato 16:9, almeno 1280×720. Massimo 5 MB.</p>
    </div>
  );
}
