"use client";

import { ActionForm } from "@/components/forms/action-form";
import { CheckCircle2, Film, Loader2, Trash2, Upload } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { FormMessage, type FormState } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { saveExamples } from "@/lib/actions/workspace";
import { safeFileName, startResumableUpload } from "@/lib/upload/resumable";

const MAX_FILES = 3;
const MAX_BYTES = 500 * 1024 * 1024;

type Item =
  | { key: string; name: string; status: "uploading"; progress: number; abort: () => void }
  | { key: string; name: string; status: "done"; path: string }
  | { key: string; name: string; status: "error"; message: string };

function nameFromPath(path: string) {
  return path.split("/").pop()?.replace(/^\d+-/, "") ?? path;
}

/**
 * Video di esempio (1-3) che piacciono all'azienda: servono all'AI per ricavare lo stile di
 * montaggio. Caricamento riprendibile: se la connessione cade, riprende da dove era arrivato.
 */
export function ExamplesForm({
  workspaceId,
  initialPaths,
  mode,
  submitLabel = "Salva",
  footer,
}: {
  workspaceId: string;
  initialPaths: string[];
  mode: "onboarding" | "settings";
  submitLabel?: string;
  footer?: React.ReactNode;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveExamples, null);
  const [items, setItems] = useState<Item[]>(
    initialPaths.map((p) => ({ key: p, name: nameFromPath(p), status: "done", path: p })),
  );
  const [pickError, setPickError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploading = items.some((i) => i.status === "uploading");
  const done = items.filter((i): i is Extract<Item, { status: "done" }> => i.status === "done");

  // Evita di lasciare la pagina a metà caricamento.
  useEffect(() => {
    if (!uploading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploading]);

  async function addFiles(files: FileList) {
    setPickError(null);
    const free = MAX_FILES - items.filter((i) => i.status !== "error").length;
    const list = Array.from(files).slice(0, Math.max(0, free));
    if (files.length > list.length) setPickError(`Puoi caricare al massimo ${MAX_FILES} video.`);

    for (const file of list) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!file.type.startsWith("video/")) {
        setItems((xs) => [
          ...xs,
          { key, name: file.name, status: "error", message: "Non è un video." },
        ]);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setItems((xs) => [
          ...xs,
          { key, name: file.name, status: "error", message: "Troppo pesante (max 500 MB)." },
        ]);
        continue;
      }
      const objectName = `${workspaceId}/esempi/${Date.now()}-${safeFileName(file.name)}`;
      try {
        const handle = await startResumableUpload({
          bucket: "brand",
          objectName,
          file,
          onProgress: (progress) =>
            setItems((xs) =>
              xs.map((x) => (x.key === key && x.status === "uploading" ? { ...x, progress } : x)),
            ),
        });
        setItems((xs) => [
          ...xs,
          { key, name: file.name, status: "uploading", progress: 0, abort: handle.abort },
        ]);
        handle.promise
          .then((path) =>
            setItems((xs) =>
              xs.map((x) => (x.key === key ? { key, name: file.name, status: "done", path } : x)),
            ),
          )
          .catch(() =>
            setItems((xs) =>
              xs.map((x) =>
                x.key === key
                  ? {
                      key,
                      name: file.name,
                      status: "error",
                      message: "Caricamento interrotto. Riprova.",
                    }
                  : x,
              ),
            ),
          );
      } catch (e) {
        const message = e instanceof Error ? e.message : "Caricamento non riuscito.";
        setItems((xs) => [...xs, { key, name: file.name, status: "error", message }]);
      }
    }
  }

  function remove(item: Item) {
    if (item.status === "uploading") item.abort();
    setItems((xs) => xs.filter((x) => x.key !== item.key));
  }

  const canAdd = items.filter((i) => i.status !== "error").length < MAX_FILES;

  return (
    <ActionForm action={action} className="grid gap-5">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <input
        type="hidden"
        name="reference_videos"
        value={JSON.stringify(done.map((d) => d.path))}
      />
      <FormMessage state={state} />

      {canAdd && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-nx-blue-500/40 bg-accent/40 px-6 py-8 text-center transition-colors hover:border-nx-blue-500/70"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow">
            <Upload className="size-5" aria-hidden />
          </span>
          <span className="grid gap-1">
            <span className="font-display font-semibold">Scegli i video</span>
            <span className="text-sm text-muted-foreground">
              Da 1 a 3 video, anche di altri. Massimo 500 MB l&apos;uno.
            </span>
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {pickError && (
        <p role="alert" className="text-[0.8125rem] font-medium text-destructive">
          {pickError}
        </p>
      )}

      {items.length > 0 && (
        <ul className="grid gap-2.5" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {item.status === "uploading" ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : item.status === "done" ? (
                  <CheckCircle2 className="size-5 text-success" aria-hidden />
                ) : (
                  <Film className="size-5" aria-hidden />
                )}
              </span>
              <div className="grid min-w-0 flex-1 gap-1.5">
                <span className="truncate text-sm font-medium">{item.name}</span>
                {item.status === "uploading" && (
                  <div className="flex items-center gap-2">
                    <Progress value={item.progress} aria-label={`Caricamento di ${item.name}`} />
                    <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                      {item.progress}%
                    </span>
                  </div>
                )}
                {item.status === "done" && (
                  <span className="text-xs text-muted-foreground">Caricato</span>
                )}
                {item.status === "error" && (
                  <span className="text-xs font-medium text-destructive">{item.message}</span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(item)}
                aria-label={
                  item.status === "uploading" ? `Annulla ${item.name}` : `Rimuovi ${item.name}`
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {footer ?? <span />}
        <SubmitButton
          variant={mode === "onboarding" ? "brand" : "default"}
          size="lg"
          disabled={uploading}
          pendingLabel="Salvataggio…"
        >
          {uploading
            ? "Attendi la fine del caricamento"
            : mode === "onboarding" && done.length === 0
              ? "Salta per ora"
              : submitLabel}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
