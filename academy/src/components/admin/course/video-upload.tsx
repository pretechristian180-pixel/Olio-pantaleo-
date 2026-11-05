"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Upload } from "lucide-react";
import { BUNNY_STATUS } from "@/lib/bunny-status";
import { formatTimestamp } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";

type Fase =
  | { tipo: "idle" }
  | { tipo: "upload"; pct: number; nome: string }
  | { tipo: "elaborazione"; label: string }
  | { tipo: "pronto"; durata: number }
  | { tipo: "errore"; msg: string };

const ACCEPT = "video/mp4,video/quicktime,video/x-m4v,video/webm";
const MAX = 20 * 1024 * 1024 * 1024; // 20 GB

/** Trascina un video o sceglilo: va dal browser a Bunny Stream, con avanzamento e ripresa automatica. */
export function VideoUpload({
  lessonId,
  hasVideo,
  durataSec,
  bunnyAttivo,
}: {
  lessonId: string;
  hasVideo: boolean;
  durataSec: number;
  bunnyAttivo: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<Fase>(
    hasVideo && durataSec > 0 ? { tipo: "pronto", durata: durataSec } : { tipo: "idle" },
  );
  const [over, setOver] = useState(false);

  // Video caricato ma ancora in elaborazione su Bunny: controlliamo ogni 5 secondi.
  useEffect(() => {
    if (!(fase.tipo === "elaborazione" || (fase.tipo === "idle" && hasVideo))) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/admin/bunny/stato/${lessonId}`)
        .then((x) => (x.ok ? x.json() : null))
        .catch(() => null);
      if (stop || !r || r.stato === "nessuno") return;
      if (r.done) {
        setFase({ tipo: "pronto", durata: r.durataSec });
        router.refresh();
      } else if (r.failed)
        setFase({ tipo: "errore", msg: `${r.label}. Riprova con un altro file.` });
      else
        setFase({
          tipo: "elaborazione",
          label: `${r.label}${r.progress ? ` (${r.progress}%)` : ""}`,
        });
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [fase.tipo, hasVideo, lessonId, router]);

  async function start(file: File) {
    if (!file.type.startsWith("video/"))
      return setFase({ tipo: "errore", msg: "Scegli un file video (MP4 o MOV)." });
    if (file.size > MAX) return setFase({ tipo: "errore", msg: "Il file supera i 20 GB." });
    setFase({ tipo: "upload", pct: 0, nome: file.name });
    const res = await fetch("/api/admin/bunny/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
    const creds = await res.json().catch(() => null);
    if (!res.ok || !creds?.videoId)
      return setFase({ tipo: "errore", msg: creds?.errore ?? "Caricamento non disponibile." });

    const { Upload: TusUpload } = await import("tus-js-client");
    const upload = new TusUpload(file, {
      endpoint: creds.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      chunkSize: 50 * 1024 * 1024,
      headers: {
        AuthorizationSignature: creds.signature,
        AuthorizationExpire: String(creds.expires),
        VideoId: creds.videoId,
        LibraryId: String(creds.libraryId),
      },
      metadata: { filetype: file.type, title: file.name },
      onProgress: (sent, total) =>
        setFase({ tipo: "upload", pct: Math.round((sent / total) * 100), nome: file.name }),
      onError: () =>
        setFase({
          tipo: "errore",
          msg: "Il caricamento si è interrotto. Riprova: riparte da dove era arrivato.",
        }),
      onSuccess: () => {
        setFase({ tipo: "elaborazione", label: BUNNY_STATUS[1]!.label });
        router.refresh();
      },
    });
    const previous = await upload.findPreviousUploads();
    if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
    upload.start();
  }

  if (!bunnyAttivo) {
    return (
      <Alert>
        Il caricamento video non è ancora attivo: servono le chiavi di Bunny Stream nelle
        impostazioni del progetto.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) start(f);
        }}
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center ${over ? "border-nexora-blue bg-blue-tint" : "border-line"}`}
      >
        <span className="flex size-13 items-center justify-center rounded-full bg-blue-tint text-nexora-blue">
          <Upload aria-hidden className="size-6" />
        </span>
        <p className="font-semibold">
          {hasVideo ? "Sostituisci il video" : "Trascina qui il video"}
        </p>
        <p className="max-w-sm text-[13px] text-ink-muted">
          MP4 o MOV. Viene caricato su Bunny Stream e protetto in automatico: nessuno può scaricarlo
          o condividerlo.
        </p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          id="video-file"
          onChange={(e) => e.target.files?.[0] && start(e.target.files[0])}
        />
        <Button
          variant="secondary"
          onClick={() => input.current?.click()}
          disabled={fase.tipo === "upload"}
        >
          Scegli file
        </Button>
      </div>
      {fase.tipo === "upload" && (
        <div>
          <div className="mb-2 flex justify-between text-[13px]">
            <span className="truncate font-semibold">{fase.nome}</span>
            <span className="tabular-nums">{fase.pct}%</span>
          </div>
          <ProgressBar value={fase.pct} size="md" track="tint" label="Caricamento del video" />
          <p className="mt-2 text-[13px] text-ink-muted">
            Non chiudere la pagina finché il caricamento non è finito.
          </p>
        </div>
      )}
      {fase.tipo === "elaborazione" && (
        <p className="text-sm text-ink-muted" aria-live="polite">
          Video caricato. {fase.label}: ci vuole qualche minuto.
        </p>
      )}
      {fase.tipo === "pronto" && (
        <p className="flex items-center gap-2 text-sm text-positive-deep" aria-live="polite">
          <CircleCheck aria-hidden className="size-4" /> Video pronto · durata{" "}
          {formatTimestamp(fase.durata)}
        </p>
      )}
      {fase.tipo === "errore" && <Alert>{fase.msg}</Alert>}
    </div>
  );
}
