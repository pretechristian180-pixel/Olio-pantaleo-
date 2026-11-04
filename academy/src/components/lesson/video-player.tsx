"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { usePlayer } from "./player-context";

const HEARTBEAT_MS = 10_000;

type Props = {
  lessonId: string;
  embedUrl: string | null;
  titolo: string;
  durataSec: number;
};

/**
 * Iframe Bunny Stream con player.js: legge il minuto, salva l'avanzamento ogni ~10 s,
 * alla pausa e quando lasci la pagina. A lezione completata aggiorna il programma.
 */
export function VideoPlayer({ lessonId, embedUrl, titolo, durataSec }: Props) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const { currentTime, registerSeek } = usePlayer();
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!embedUrl || !iframe.current) return;
    let disposed = false;
    let watched = 0; // secondi guardati dall'ultimo invio
    let lastTick: number | null = null;
    let duration = durataSec;
    let completed = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const send = (keepalive = false) => {
      const delta = Math.round(watched);
      watched = 0;
      const body = JSON.stringify({
        lessonId,
        secondo: Math.floor(currentTime.current),
        delta,
        durata: duration,
      });
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((res: { completata?: boolean } | null) => {
          if (res?.completata && !completed && !disposed) {
            completed = true;
            router.refresh();
          }
        })
        .catch(() => {});
    };

    const onLeave = () => {
      if (document.visibilityState === "hidden" && watched > 0) send(true);
    };

    import("player.js")
      .then(({ default: playerjs }) => {
        if (disposed || !iframe.current) return;
        const player = new playerjs.Player(iframe.current);
        player.on("ready", () => {
          registerSeek((s) => {
            player.setCurrentTime(s);
            player.play();
          });
          player.getDuration((d) => {
            if (d > 0) duration = Math.round(d);
          });
          player.on("timeupdate", ({ seconds }) => {
            // Conta solo la visione continua: un salto in avanti non vale come "guardato".
            if (lastTick !== null) {
              const step = seconds - lastTick;
              if (step > 0 && step < 3) watched += step;
            }
            lastTick = seconds;
            currentTime.current = seconds;
          });
          player.on("play", () => {
            if (!timer) timer = setInterval(() => watched > 0 && send(), HEARTBEAT_MS);
          });
          player.on("pause", () => {
            lastTick = null;
            send();
          });
          player.on("ended", () => {
            lastTick = null;
            send();
          });
        });
      })
      .catch(() => setError(true));

    document.addEventListener("visibilitychange", onLeave);
    window.addEventListener("pagehide", onLeave);
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      if (watched > 0) send(true);
      document.removeEventListener("visibilitychange", onLeave);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [embedUrl, lessonId, durataSec, currentTime, registerSeek, router]);

  if (!embedUrl) {
    return (
      <VideoFrame>
        <div className="flex h-full flex-col p-5">
          <Eyebrow as="span" className="text-[11px] text-white/80">
            Player video · Bunny Stream
          </Eyebrow>
          <div className="m-auto flex flex-col items-center gap-4 px-6 text-center">
            <span className="flex size-19 items-center justify-center rounded-full bg-white/10">
              <Play aria-hidden className="size-6 fill-current" />
            </span>
            <p className="max-w-sm text-sm text-white/80">
              Il video di questa lezione arriva a breve.
            </p>
          </div>
        </div>
      </VideoFrame>
    );
  }

  return (
    <VideoFrame>
      <iframe
        ref={iframe}
        src={embedUrl}
        title={`Video: ${titolo}`}
        loading="eager"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 size-full border-0"
      />
      {error && (
        <p
          role="alert"
          className="absolute inset-x-0 bottom-0 bg-negative px-4 py-2 text-sm text-white"
        >
          Il video si vede ma non riusciamo a salvare l&apos;avanzamento. Ricarica la pagina.
        </p>
      )}
    </VideoFrame>
  );
}

export function VideoFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-graphite-deep text-white md:rounded-lg">
      {children}
    </div>
  );
}
