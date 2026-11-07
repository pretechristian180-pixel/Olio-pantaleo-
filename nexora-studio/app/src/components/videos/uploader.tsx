"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Film,
  Layers,
  Loader2,
  Mic,
  Plus,
  RotateCcw,
  Smartphone,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/select-native";
import { Progress } from "@/components/ui/progress";
import { type ClipKind, registerClips } from "@/lib/actions/videos";
import { safeFileName, startResumableUpload, UploadError } from "@/lib/upload/resumable";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_SECONDS = 10 * 60;
const MAX_CLIPS = 10;
const MAX_REFERENCE_SECONDS = 3 * 60;

type Meta = { duration: number | null; width: number | null; height: number | null };

/** Legge durata e dimensioni dal browser (se il formato non è leggibile, controlla il server). */
function readMeta(file: File): Promise<Meta> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    let settled = false;
    const done = (m: Meta) => {
      if (settled) return;
      settled = true;
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

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

type Clip = {
  id: string;
  file: File;
  meta: Meta;
  kind: ClipKind;
  description: string;
  /** Percorso nello storage, fisso per la clip: un nuovo tentativo riprende da dove era arrivato. */
  objectName: string;
  /** Impostato quando il caricamento è finito (al nuovo tentativo non si ricarica). */
  storagePath?: string;
};

type Phase =
  | { step: "edit" }
  | { step: "uploading"; index: number; progress: number; abort: () => void }
  | { step: "saving" };

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
  const [clips, setClips] = useState<Clip[]>([]);
  const [phase, setPhase] = useState<Phase>({ step: "edit" });
  const [error, setError] = useState<string | null>(null);
  const [scriptId, setScriptId] = useState(defaultScriptId ?? scripts[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState<Clip | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const busy = phase.step !== "edit";

  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function add(files: File[]) {
    setError(null);
    const room = MAX_CLIPS - clips.length;
    if (files.length > room) {
      setError(`Puoi caricare al massimo ${MAX_CLIPS} clip per video.`);
      files = files.slice(0, Math.max(0, room));
    }
    const added: Clip[] = [];
    for (const file of files) {
      if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) {
        setError(`«${file.name}» non è un video.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`«${file.name}» supera i 2 GB.`);
        continue;
      }
      const meta = await readMeta(file);
      if (meta.duration && meta.duration > MAX_SECONDS + 1) {
        setError(`«${file.name}» supera i 10 minuti.`);
        continue;
      }
      added.push({
        id: crypto.randomUUID(),
        file,
        meta,
        // La prima clip è quasi sempre una ripresa parlata; le successive anche, salvo cambio.
        kind: "speech",
        description: "",
        objectName: `${workspaceId}/${crypto.randomUUID()}/${safeFileName(file.name)}`,
      });
    }
    setClips((c) => [...c, ...added]);
  }

  const update = (id: string, patch: Partial<Clip>) => {
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setReference((r) => (r && r.id === id ? { ...r, ...patch } : r));
  };

  /** Video di riferimento: uno solo, fino a 3 minuti (ne analizziamo lo stile, non il contenuto). */
  async function pickReference(file: File) {
    setError(null);
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) {
      return setError(`«${file.name}» non è un video.`);
    }
    if (file.size > MAX_BYTES) return setError(`«${file.name}» supera i 2 GB.`);
    const meta = await readMeta(file);
    if (meta.duration && meta.duration > MAX_REFERENCE_SECONDS + 1) {
      return setError("Il video di riferimento può durare al massimo 3 minuti: basta un reel di esempio.");
    }
    setReference({
      id: crypto.randomUUID(),
      file,
      meta,
      kind: "reference",
      description: "",
      objectName: `${workspaceId}/${crypto.randomUUID()}/riferimento-${safeFileName(file.name)}`,
    });
  }

  const speech = clips.filter((c) => c.kind === "speech");
  const speechSeconds = speech.reduce((sum, c) => sum + (c.meta.duration ?? 0), 0);
  const tooLong = speechSeconds > MAX_SECONDS + 1;
  const landscape = speech.some((c) => c.meta.width && c.meta.height && c.meta.width > c.meta.height);
  const canSubmit = clips.length > 0 && speech.length > 0 && !tooLong && !busy;

  async function submit() {
    setError(null);
    const list = [...clips, ...(reference ? [reference] : [])];
    for (let i = 0; i < list.length; i++) {
      const clip = list[i]!;
      if (clip.storagePath) continue;
      const objectName = clip.objectName;
      try {
        const handle = await startResumableUpload({
          bucket: "raw",
          objectName,
          file: clip.file,
          onProgress: (progress) =>
            setPhase((p) => (p.step === "uploading" ? { ...p, progress } : p)),
        });
        setPhase({ step: "uploading", index: i, progress: 0, abort: handle.abort });
        await handle.promise;
      } catch (e) {
        setPhase({ step: "edit" });
        const status = e instanceof UploadError ? e.status : null;
        setError(
          status === 413
            ? `«${clip.file.name}» è troppo grande per essere caricato. Toglila o accorciala e riprova: le clip già caricate restano.`
            : status === 415
              ? `«${clip.file.name}» è in un formato video non supportato.`
              : "Il caricamento si è interrotto. Controlla la connessione e premi di nuovo «Carica e monta»: le clip già caricate non ripartono da capo e quella interrotta riprende da dove era arrivata.",
        );
        return;
      }
      list[i] = { ...clip, storagePath: objectName };
      update(clip.id, { storagePath: objectName });
    }

    setPhase({ step: "saving" });
    const res = await registerClips({
      workspaceId,
      scriptId: scriptId || null,
      clips: list.map((c) => ({
        storagePath: c.storagePath!,
        fileName: c.file.name,
        sizeBytes: c.file.size,
        mimeType: c.file.type || "video/mp4",
        kind: c.kind,
        description: c.kind === "cover" ? c.description : null,
      })),
      editNotes: notes.trim() || null,
    });
    if (res.error || !res.videoId) {
      setPhase({ step: "edit" });
      setError(res.error ?? "Qualcosa è andato storto.");
      return;
    }
    router.push(`/video/${res.videoId}`);
  }

  const totalFiles = clips.length + (reference ? 1 : 0);
  const uploadedCount = clips.filter((c) => c.storagePath).length + (reference?.storagePath ? 1 : 0);
  const overall =
    phase.step === "uploading"
      ? Math.round(((uploadedCount + phase.progress / 100) / totalFiles) * 100)
      : phase.step === "saving"
        ? 100
        : 0;

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
          disabled={busy}
        >
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
          <option value="">Video libero (senza script)</option>
        </NativeSelect>
      </div>

      {clips.length === 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-nx-blue-500/40 bg-accent/40 px-6 py-12 text-center transition-colors hover:border-nx-blue-500/70"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow">
            <Upload className="size-6" aria-hidden />
          </span>
          <span className="grid gap-1">
            <span className="font-display text-lg font-semibold">Scegli i video</span>
            <span className="text-sm text-muted-foreground">
              Uno o più clip dalla galleria o dal computer, fino a {MAX_CLIPS}. Le riprese in cui
              parli insieme: massimo 10 minuti.
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
        aria-label="Scegli i video"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void add(files);
          e.target.value = "";
        }}
      />

      <input
        ref={refInputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Scegli il video di riferimento"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pickReference(f);
          e.target.value = "";
        }}
      />

      {clips.length > 0 && (
        <div className="grid gap-3 rounded-2xl border bg-card p-4">
          <ul className="grid gap-3" aria-label="Clip del video">
            {clips.map((clip, i) => {
              const uploading = phase.step === "uploading" && phase.index === i;
              return (
                <li key={clip.id} className="grid gap-3 rounded-xl border bg-background/40 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      {clip.storagePath ? (
                        <CheckCircle2 className="size-5 text-success" aria-label="Caricata" />
                      ) : uploading ? (
                        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                      ) : (
                        <Film className="size-5 text-muted-foreground" aria-hidden />
                      )}
                    </span>
                    <div className="grid min-w-0 flex-1">
                      <span className="truncate text-sm font-medium">{clip.file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatSize(clip.file.size)}
                        {clip.meta.duration ? ` · ${formatDuration(clip.meta.duration)} min` : ""}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      onClick={() => setClips((cs) => cs.filter((c) => c.id !== clip.id))}
                      aria-label={`Togli ${clip.file.name}`}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                  <div
                    role="group"
                    aria-label={`Cosa c'è in ${clip.file.name}`}
                    className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
                  >
                    {(
                      [
                        { kind: "speech", label: "Parlo io", Icon: Mic },
                        { kind: "cover", label: "Copertura", Icon: Layers },
                      ] as const
                    ).map(({ kind, label, Icon }) => (
                      <button
                        key={kind}
                        type="button"
                        disabled={busy}
                        aria-pressed={clip.kind === kind}
                        onClick={() => update(clip.id, { kind })}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                          clip.kind === kind
                            ? "bg-card font-medium shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4" aria-hidden /> {label}
                      </button>
                    ))}
                  </div>
                  {clip.kind === "cover" && (
                    <Input
                      value={clip.description}
                      maxLength={200}
                      disabled={busy}
                      onChange={(e) => update(clip.id, { description: e.target.value })}
                      placeholder="Cosa si vede? Es. il forno acceso, la vetrina (facoltativo)"
                      aria-label={`Cosa si vede in ${clip.file.name}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {!busy && clips.length < MAX_CLIPS && (
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <Plus aria-hidden /> Aggiungi altre clip
            </Button>
          )}

          {clips.length > 1 && (
            <p className="text-xs text-muted-foreground">
              «Parlo io»: le riprese in cui parli, le mettiamo in ordine noi seguendo lo script.
              «Copertura»: immagini senza parlato (prodotti, locale, lavorazioni) che mettiamo sopra la
              tua voce.
            </p>
          )}
          <div className="grid gap-2 border-t pt-4">
            <label htmlFor="edit_notes" className="text-sm font-medium">
              Come vuoi il montaggio? <span className="font-normal text-muted-foreground">(facoltativo)</span>
            </label>
            <Textarea
              id="edit_notes"
              value={notes}
              maxLength={1000}
              rows={3}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. ritmo veloce, sottotitoli grandi in maiuscolo, niente musica, tieni la battuta finale"
            />
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">
              Video di riferimento <span className="font-normal text-muted-foreground">(facoltativo)</span>
            </span>
            {reference ? (
              <div className="flex items-center gap-3 rounded-xl border bg-background/40 p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {reference.storagePath ? (
                    <CheckCircle2 className="size-5 text-success" aria-label="Caricato" />
                  ) : (
                    <Sparkles className="size-5 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <div className="grid min-w-0 flex-1">
                  <span className="truncate text-sm font-medium">{reference.file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatSize(reference.file.size)}
                    {reference.meta.duration ? ` · ${formatDuration(reference.meta.duration)} min` : ""}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  onClick={() => setReference(null)}
                  aria-label="Togli il video di riferimento"
                >
                  <X aria-hidden />
                </Button>
              </div>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => refInputRef.current?.click()}>
                <Sparkles aria-hidden /> Allega un video da imitare
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Un reel che ti piace: ne prendiamo ritmo, sottotitoli e stile del montaggio. Transizioni
              animate ed effetti grafici non si possono copiare.
            </p>
          </div>

          {speech.length === 0 && (
            <Alert variant="warning">
              <AlertTriangle aria-hidden />
              <AlertTitle>Manca una ripresa in cui parli</AlertTitle>
              <AlertDescription>
                Le clip di copertura vanno sopra la voce: segna come «Parlo io» almeno una clip.
              </AlertDescription>
            </Alert>
          )}
          {tooLong && (
            <Alert variant="warning">
              <AlertTriangle aria-hidden />
              <AlertTitle>Le riprese durano più di 10 minuti</AlertTitle>
              <AlertDescription>
                Insieme fanno {formatDuration(speechSeconds)} min: togli qualche ripresa.
              </AlertDescription>
            </Alert>
          )}
          {landscape && !tooLong && (
            <Alert variant="warning">
              <AlertTriangle aria-hidden />
              <AlertTitle>C&apos;è una ripresa orizzontale</AlertTitle>
              <AlertDescription>
                La monteremo in verticale. La prossima volta tieni il telefono in verticale: il
                risultato è migliore.
              </AlertDescription>
            </Alert>
          )}

          {busy ? (
            <div className="grid gap-3" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {phase.step === "saving"
                    ? "Avvio il montaggio…"
                    : phase.index >= clips.length
                      ? "Caricamento del video di riferimento…"
                      : totalFiles > 1
                        ? `Caricamento clip ${phase.index + 1} di ${clips.length}…`
                      : "Caricamento in corso…"}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">{overall}%</span>
              </div>
              <Progress value={overall} aria-label="Avanzamento del caricamento" />
              <p className="text-xs text-muted-foreground">
                Non chiudere questa pagina. Se la connessione cade, il caricamento riprende da solo.
              </p>
              {phase.step === "uploading" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    phase.abort();
                    setPhase({ step: "edit" });
                  }}
                >
                  Annulla
                </Button>
              )}
            </div>
          ) : (
            <Button variant="brand" size="lg" disabled={!canSubmit} onClick={() => void submit()}>
              {error && uploadedCount > 0 ? <RotateCcw aria-hidden /> : <Upload aria-hidden />}{" "}
              Carica e monta
            </Button>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Attenzione</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Alert variant="info">
        <Smartphone aria-hidden />
        <AlertTitle>Consigli veloci</AlertTitle>
        <AlertDescription>
          Telefono in verticale, luce davanti a te, parla con calma. Se sbagli una frase, ripetila:
          i tagli li facciamo noi. Puoi girare anche una frase per clip.
        </AlertDescription>
      </Alert>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5" aria-hidden /> I tuoi video restano privati finché non li
        approvi.
      </p>
    </div>
  );
}
