"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { addResource, deleteResource } from "@/app/admin/corsi/actions";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const MAX = 50 * 1024 * 1024;

type Res = { id: string; nome: string; tipo: string; dimensione_bytes: number };

export function Materials({
  tenantId,
  courseId,
  lessonId,
  resources,
}: {
  tenantId: string;
  courseId: string;
  lessonId: string;
  resources: Res[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function upload(files: FileList | null) {
    if (!files?.length) return;
    start(async () => {
      for (const file of Array.from(files)) {
        if (file.size > MAX) {
          setError(`«${file.name}» supera i 50 MB.`);
          continue;
        }
        const safe = file.name
          .normalize("NFD")
          .replace(/[^\w.-]+/g, "-")
          .slice(-100);
        const path = `${tenantId}/${courseId}/${lessonId}/${Date.now()}-${safe}`;
        const { error: up } = await createClient()
          .storage.from("materiali")
          .upload(path, file, { contentType: file.type || undefined });
        if (up) {
          setError(`Caricamento di «${file.name}» non riuscito.`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "file";
        const r = await addResource(courseId, lessonId, {
          nome: file.name,
          tipo: ext,
          storage_path: path,
          dimensione_bytes: file.size,
        });
        if (!r.ok) setError(r.error);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {resources.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-md border border-line p-3">
              <FileText aria-hidden className="size-5 shrink-0 text-nexora-blue-bright" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.nome}</span>
              <span className="text-xs text-ink-muted">
                {Math.max(1, Math.round(r.dimensione_bytes / 1024))} KB
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Elimina ${r.nome}`}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const x = await deleteResource(courseId, r.id);
                    if (!x.ok) setError(x.error);
                    router.refresh();
                  })
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">
          Nessun materiale. PDF, modelli Excel o slide si scaricano dalla lezione.
        </p>
      )}
      {error && <Alert>{error}</Alert>}
      <div>
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          id="materiali"
          onChange={(e) => upload(e.target.files)}
        />
        <Button variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
          <Paperclip aria-hidden /> {pending ? "Caricamento…" : "Aggiungi materiali"}
        </Button>
        <p className="mt-2 text-[13px] text-ink-muted">
          Fino a 50 MB per file. Li scarica solo chi ha accesso alla lezione.
        </p>
      </div>
    </div>
  );
}
