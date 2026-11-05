"use client";

import {
  AlertTriangle,
  Check,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { submitVideo } from "@/lib/upload/submit-video";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 10 * 60;
/** Formati in ordine di preferenza: MP4 (iPhone, Chrome recenti), poi WebM (Android). */
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];
const SPEEDS = [
  { label: "Lenta", pxPerSec: 22 },
  { label: "Media", pxPerSec: 34 },
  { label: "Veloce", pxPerSec: 48 },
];

type Phase =
  | { name: "intro" }
  | { name: "starting" }
  | { name: "ready" }
  | { name: "countdown"; n: number }
  | { name: "recording" }
  | { name: "review"; url: string; file: File }
  | { name: "uploading"; progress: number }
  | { name: "error"; message: string; canRetry?: boolean };

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Registrazione dal telefono con la fotocamera frontale e il testo dello script che scorre
 * in alto, vicino all'obiettivo. Il testo non finisce nel video. Alla fine: rivedi, rifai
 * o usa (caricamento riprendibile e avvio del montaggio, come per i video dalla galleria).
 */
export function TeleprompterRecorder({
  workspaceId,
  script,
}: {
  workspaceId: string;
  script: { id: string; title: string; hook: string; body: string } | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);
  const scrollRef = useRef({ y: 0, last: 0, raf: 0, sec: -1 });
  const startedAtRef = useRef(0);

  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [speed, setSpeed] = useState(1);
  const [fontSize, setFontSize] = useState(26);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<(() => void) | null>(null);

  const text = script ? [script.hook, script.body].filter(Boolean).join("\n\n") : "";

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void wakeRef.current?.release().catch(() => undefined);
    wakeRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  // Avviso prima di chiudere durante registrazione o caricamento
  useEffect(() => {
    if (phase.name !== "recording" && phase.name !== "uploading" && phase.name !== "review") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase.name]);

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia || pickMime() === null) {
      setPhase({
        name: "error",
        message:
          "Questo browser non permette di registrare dalla pagina. Usa Safari su iPhone o Chrome su Android aggiornati, oppure registra con la fotocamera e carica il video.",
      });
      return;
    }
    setPhase({ name: "starting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 },
          frameRate: { ideal: 30 },
        },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      try {
        const wl = (
          navigator as Navigator & {
            wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock;
        wakeRef.current = (await wl?.request("screen")) ?? null;
      } catch {
        /* lo schermo può spegnersi: l'utente lo tocca durante la lettura */
      }
      setPhase({ name: "ready" });
    } catch (e) {
      const denied =
        e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      setPhase({
        name: "error",
        canRetry: true,
        message: denied
          ? "Serve il permesso per fotocamera e microfono. Consentilo nelle impostazioni del browser per questo sito e riprova."
          : "Non riusciamo ad aprire la fotocamera. Chiudi le altre app che la usano e riprova.",
      });
    }
  }

  // Scorrimento del testo durante la registrazione
  useEffect(() => {
    if (phase.name !== "recording") return;
    const s = scrollRef.current;
    s.last = performance.now();
    const tick = (now: number) => {
      const dt = (now - s.last) / 1000;
      s.last = now;
      if (!paused) s.y += SPEEDS[speed]!.pxPerSec * dt * (fontSize / 26);
      if (textRef.current) textRef.current.style.transform = `translateY(${-s.y}px)`;
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
      if (secs !== s.sec) {
        s.sec = secs;
        setElapsed(secs);
      }
      if (secs >= MAX_SECONDS) stopRecording();
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [phase.name, paused, speed, fontSize]);

  function startCountdown() {
    scrollRef.current.y = 0;
    scrollRef.current.sec = -1;
    if (textRef.current) textRef.current.style.transform = "translateY(0)";
    let n = 3;
    setPhase({ name: "countdown", n });
    const id = setInterval(() => {
      n -= 1;
      if (n > 0) setPhase({ name: "countdown", n });
      else {
        clearInterval(id);
        startRecording();
      }
    }, 1000);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickMime() ?? "";
    chunksRef.current = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: 8_000_000,
        audioBitsPerSecond: 128_000,
      });
    } catch {
      rec = new MediaRecorder(stream);
    }
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = (rec.mimeType || mime || "video/mp4").split(";")[0]!;
      const ext = type.includes("webm") ? "webm" : "mp4";
      const blob = new Blob(chunksRef.current, { type });
      const file = new File(
        [blob],
        `teleprompter-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`,
        { type },
      );
      setPhase({ name: "review", url: URL.createObjectURL(blob), file });
    };
    recorderRef.current = rec;
    rec.start(1000);
    startedAtRef.current = Date.now();
    setElapsed(0);
    setPaused(false);
    setPhase({ name: "recording" });
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  function retake() {
    if (phase.name === "review") URL.revokeObjectURL(phase.url);
    setPhase({ name: "ready" });
  }

  async function acceptTake(file: File) {
    stopStream();
    setPhase({ name: "uploading", progress: 0 });
    const res = await submitVideo({
      workspaceId,
      file,
      scriptId: script?.id ?? null,
      onProgress: (progress) => setPhase((p) => (p.name === "uploading" ? { ...p, progress } : p)),
      onAbortReady: (abort) => (abortRef.current = abort),
    });
    if (res.videoId) router.push(`/video/${res.videoId}`);
    else
      setPhase({
        name: "error",
        message: res.error ?? "Qualcosa è andato storto.",
        canRetry: false,
      });
  }

  const showCamera = ["ready", "countdown", "recording", "starting"].includes(phase.name);
  const exitHref = script ? `/script/${script.id}` : "/video/carica";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      data-testid="teleprompter"
    >
      {/* Fotocamera (anteprima a specchio, come uno specchio; il video registrato non è specchiato) */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-label="Anteprima della fotocamera"
        className={cn(
          "absolute inset-0 h-full w-full -scale-x-100 object-cover",
          !showCamera && "hidden",
        )}
      />

      {/* Testo in alto, vicino all'obiettivo */}
      {showCamera && text && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[42%] overflow-hidden bg-gradient-to-b from-black/80 via-black/60 to-transparent pt-[max(env(safe-area-inset-top),12px)]">
          <div
            className="absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),12px)+2.5rem)] z-10 h-0.5 bg-nx-blue-500/70"
            aria-hidden
          />
          <div
            ref={textRef}
            className="px-6 pt-10 pb-[60vh] leading-snug font-semibold whitespace-pre-line will-change-transform"
            style={{ fontSize }}
            aria-live="off"
          >
            {text}
          </div>
        </div>
      )}

      {/* Barra superiore */}
      <div className="relative z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
        {phase.name !== "recording" && phase.name !== "uploading" ? (
          <Link
            href={exitHref}
            onClick={() => stopStream()}
            aria-label="Chiudi il teleprompter"
            className="flex size-10 items-center justify-center rounded-full bg-black/50 backdrop-blur"
          >
            <X className="size-5" aria-hidden />
          </Link>
        ) : (
          <span />
        )}
        {phase.name === "recording" && (
          <span
            className="flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-sm font-semibold tabular-nums"
            role="timer"
          >
            <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden />{" "}
            {mmss(elapsed)}
          </span>
        )}
      </div>

      {/* Contenuto per fase */}
      <div className="relative z-20 mt-auto grid gap-4 px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        {phase.name === "intro" && (
          <div className="mx-auto mb-[20vh] grid max-w-sm gap-4 text-center">
            <Video className="mx-auto size-10 text-nx-blue-300" aria-hidden />
            <h1 className="text-2xl font-semibold">Registra con il teleprompter</h1>
            <p className="text-white/80">
              Tieni il telefono in verticale, all&apos;altezza degli occhi. Il testo scorre in alto,
              vicino alla fotocamera: leggendo guarderai quasi in camera. Il testo non comparirà nel
              video.
            </p>
            {!script && (
              <p className="text-sm text-white/60">Video libero: nessun testo a schermo.</p>
            )}
            <Button variant="brand" size="lg" onClick={() => void openCamera()}>
              Apri la fotocamera
            </Button>
            <Link
              href="/video/carica"
              className="text-sm text-white/70 underline underline-offset-4"
            >
              Preferisco caricare un video dalla galleria
            </Link>
          </div>
        )}

        {phase.name === "starting" && (
          <p className="mb-[30vh] flex items-center justify-center gap-2 text-white/80">
            <Loader2 className="animate-spin" aria-hidden /> Apertura della fotocamera…
          </p>
        )}

        {phase.name === "countdown" && (
          <p
            className="mb-[25vh] text-center font-display text-8xl font-bold"
            aria-live="assertive"
          >
            {phase.n}
          </p>
        )}

        {(phase.name === "ready" || phase.name === "recording") && text && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <div
              className="flex rounded-full bg-black/60 p-1 backdrop-blur"
              role="group"
              aria-label="Velocità del testo"
            >
              {SPEEDS.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSpeed(i)}
                  aria-pressed={speed === i}
                  className={cn(
                    "rounded-full px-3 py-1.5",
                    speed === i ? "bg-white text-black" : "text-white/80",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div
              className="flex items-center rounded-full bg-black/60 p-1 backdrop-blur"
              role="group"
              aria-label="Dimensione del testo"
            >
              <button
                type="button"
                onClick={() => setFontSize((f) => Math.max(18, f - 3))}
                aria-label="Testo più piccolo"
                className="rounded-full p-1.5"
              >
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="px-1 text-xs">Aa</span>
              <button
                type="button"
                onClick={() => setFontSize((f) => Math.min(40, f + 3))}
                aria-label="Testo più grande"
                className="rounded-full p-1.5"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        )}

        {phase.name === "ready" && (
          <div className="grid justify-items-center gap-2">
            <button
              type="button"
              onClick={startCountdown}
              aria-label="Inizia a registrare"
              className="flex size-20 items-center justify-center rounded-full border-4 border-white"
            >
              <span className="size-14 rounded-full bg-red-600" />
            </button>
            <span className="text-xs text-white/70">
              Parte dopo un conto alla rovescia di 3 secondi
            </span>
          </div>
        )}

        {phase.name === "recording" && (
          <div className="flex items-center justify-center gap-6">
            {text && (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={
                  paused ? "Riprendi lo scorrimento del testo" : "Ferma lo scorrimento del testo"
                }
                className="flex size-12 items-center justify-center rounded-full bg-black/60 backdrop-blur"
              >
                {paused ? (
                  <Play className="size-5" aria-hidden />
                ) : (
                  <Pause className="size-5" aria-hidden />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={stopRecording}
              aria-label="Ferma la registrazione"
              className="flex size-20 items-center justify-center rounded-full border-4 border-white"
            >
              <Square className="size-8 fill-red-600 text-red-600" aria-hidden />
            </button>
            {text && <span className="w-12" />}
          </div>
        )}

        {phase.name === "review" && (
          <div className="grid gap-4">
            <video
              src={phase.url}
              controls
              playsInline
              autoPlay
              className="mx-auto max-h-[62vh] rounded-2xl bg-black"
              aria-label="Il video appena registrato"
            />
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={retake}
                className="border-white/40 bg-transparent text-white hover:bg-white/10"
              >
                <RotateCcw aria-hidden /> Rifai
              </Button>
              <Button variant="brand" size="lg" onClick={() => void acceptTake(phase.file)}>
                <Check aria-hidden /> Usa questo
              </Button>
            </div>
          </div>
        )}

        {phase.name === "uploading" && (
          <div
            className="mx-auto mb-[25vh] grid w-full max-w-sm gap-3 text-center"
            aria-live="polite"
          >
            <p className="font-semibold">Caricamento del video…</p>
            <Progress value={phase.progress} aria-label={`Caricamento ${phase.progress}%`} />
            <p className="text-sm text-white/70">
              {phase.progress}% · Non chiudere la pagina. Se la connessione cade, riprende da sola.
            </p>
          </div>
        )}

        {phase.name === "error" && (
          <div className="mx-auto mb-[20vh] grid max-w-sm gap-4 text-center" role="alert">
            <AlertTriangle className="mx-auto size-10 text-warning" aria-hidden />
            <p>{phase.message}</p>
            {phase.canRetry && (
              <Button variant="brand" size="lg" onClick={() => void openCamera()}>
                Riprova
              </Button>
            )}
            <Link
              href="/video/carica"
              className="text-sm text-white/70 underline underline-offset-4"
            >
              Carica un video dalla galleria
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
