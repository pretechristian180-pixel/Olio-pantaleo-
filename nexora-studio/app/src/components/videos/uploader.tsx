"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Film,
  Loader2,
  RotateCcw,
  Smartphone,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select-native";
import { Progress } from "@/components/ui/progress";
import { registerUpload } from "@/lib/actions/videos";
import { safeFileName, startResumableUpload } from "@/lib/upload/resumable";

const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_SECONDS = 10 * 60;

type Meta = { duration: number | null; width: number | null; height: number | null };

/** Legge durata e dimensioni dal browser (se il formato non è leggibile, controlla il server). */
function readMeta(file: File): Promise<Meta> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (m: Meta) => {
      URL.revokeObjectURL(url);
      resolve(m);
    };
    v.onloadedmetadata = () =>
      done({
        duration: Number.isFinite(v.duration) ? v.duration : null,
        width: v.videoWidth || null,
        height: v.videoHeight || null,
      });
    v.onerror = () => done({ duration: null, width: null, height: null });
    setTimeout(() => done({ duration: null, width: null, height: null }), 8000);
    v.src = url;
  });
}

function formatSize(bytes: number) {
  return bytes > 1e9
    ? `${(bytes / 1e9).toFixed(1)} GB`
    : `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

type State =
  | { step: "pick" }
  | { step: "check"; file: File; meta: Meta }
  | { step: "uploading"; file: File; progress: number; abort: () => void }
  | { step: "saving"; file: File }
  | { step: "error"; message: string; file?: File; meta?: Meta };

export function Uploader({
  workspaceId,
  scripts,
  defaultScriptId,
}: {
  workspaceId: string;
  scripts: { id: string; title: string }[];
  defaultScriptId: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: "pick" });
  const [scriptId, setScriptId] = useState(defaultScriptId ?? scripts[0]?.id ?? "");

  useEffect(() => {
    if (state.step !== "uploading" && state.step !== "saving") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.step]);

  async function pick(file: File) {
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) {
      return setState({
        step: "error",
        message: "Questo file non è un video. Scegli un video dalla galleria.",
      });
    }
    if (file.size > MAX_BYTES) {
      return setState({
        step: "error",
        message: "Il video supera i 2 GB. Prova a girarlo più breve.",
      });
    }
    const meta = await readMeta(file);
    if (meta.duration && meta.duration > MAX_SECONDS + 1) {
      return setState({
        step: "error",
        message: "Il video supera i 10 minuti. Caricane uno più breve.",
      });
    }
    setState({ step: "check", file, meta });
  }

  async function upload(file: File) {
    const id = crypto.randomUUID();
    const objectName = `${workspaceId}/${id}/${safeFileName(file.name)}`;
    try {
      const handle = await startResumableUpload({
        bucket: "raw",
        objectName,
        file,
        onProgress: (progress) =>
          setState((s) => (s.step === "uploading" ? { ...s, progress } : s)),
      });
      setState({ step: "uploading", file, progress: 0, abort: handle.abort });
      await handle.promise;
    } catch {
      return setState({
        step: "error",
        file,
        message:
          "Il caricamento si è interrotto. Controlla la connessione e riprova: ripartirà da dove era arrivato.",
      });
    }
    setState({ step: "saving", file });
    const res = await registerUpload({
      workspaceId,
      storagePath: objectName,
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: file.type || "video/mp4",
      scriptId: scriptId || null,
    });
    if (res.error || !res.videoId)
      return setState({ step: "error", message: res.error ?? "Qualcosa è andato storto." });
    router.push(`/video/${res.videoId}`);
  }

  const landscape =
    state.step === "check" && state.meta.width && state.meta.height
      ? state.meta.width > state.meta.height
      : false;

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="script" className="text-sm font-medium">
          Per quale script è questo video?
        </label>
        <NativeSelect
          id="script"
          value={scriptId}
          onChange={(e) => setScriptId(e.target.value)}
          disabled={state.step === "uploading" || state.step === "saving"}
        >
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
          <option value="">Video libero (senza script)</option>
        </NativeSelect>
      </div>

      {state.step === "pick" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-nx-blue-500/40 bg-accent/40 px-6 py-12 text-center transition-colors hover:border-nx-blue-500/70"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow">
            <Upload className="size-6" aria-hidden />
          </span>
          <span className="grid gap-1">
            <span className="font-display text-lg font-semibold">Scegli il video</span>
            <span className="text-sm text-muted-foreground">
              Dalla galleria del telefono o dal computer. Fino a 10 minuti.
            </span>
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = "";
        }}
      />

      {state.step === "check" && (
        <div className="grid gap-4 rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-muted">
              <Film className="size-5 text-muted-foreground" aria-hidden />
            </span>
            <div className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium">{state.file.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatSize(state.file.size)}
                {state.meta.duration
                  ? ` · ${Math.floor(state.meta.duration / 60)}:${String(Math.round(state.meta.duration % 60)).padStart(2, "0")} min`
                  : ""}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setState({ step: "pick" })}
              aria-label="Scegli un altro video"
            >
              <X aria-hidden />
            </Button>
          </div>
          {landscape && (
            <Alert variant="warning">
              <AlertTriangle aria-hidden />
              <AlertTitle>Il video è orizzontale</AlertTitle>
              <AlertDescription>
                Lo monteremo in verticale su uno sfondo sfocato. La prossima volta tieni il telefono
                in verticale: il risultato è migliore.
              </AlertDescription>
            </Alert>
          )}
          <Button variant="brand" size="lg" onClick={() => void upload(state.file)}>
            <Upload aria-hidden /> Carica e monta
          </Button>
        </div>
      )}

      {(state.step === "uploading" || state.step === "saving") && (
        <div className="grid gap-3 rounded-2xl border bg-card p-5" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {state.step === "saving" ? "Avvio il montaggio…" : "Caricamento in corso…"}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {state.step === "uploading" ? `${state.progress}%` : "100%"}
            </span>
          </div>
          <Progress
            value={state.step === "uploading" ? state.progress : 100}
            aria-label="Avanzamento del caricamento"
          />
          <p className="text-xs text-muted-foreground">
            Non chiudere questa pagina. Se la connessione cade, il caricamento riprende da solo.
          </p>
          {state.step === "uploading" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                state.abort();
                setState({ step: "pick" });
              }}
            >
              Annulla
            </Button>
          )}
        </div>
      )}

      {state.step === "error" && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Video non caricato</AlertTitle>
          <AlertDescription className="grid gap-3">
            <p>{state.message}</p>
            <div className="flex flex-wrap gap-2">
              {state.file && (
                <Button size="sm" variant="outline" onClick={() => void upload(state.file!)}>
                  <RotateCcw aria-hidden /> Riprova
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setState({ step: "pick" })}>
                Scegli un altro video
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Alert variant="info">
        <Smartphone aria-hidden />
        <AlertTitle>Consigli veloci</AlertTitle>
        <AlertDescription>
          Telefono in verticale, luce davanti a te, parla con calma. Se sbagli una frase, ripetila:
          i tagli li facciamo noi.
        </AlertDescription>
      </Alert>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5" aria-hidden /> I tuoi video restano privati finché non li
        approvi.
      </p>
    </div>
  );
}
