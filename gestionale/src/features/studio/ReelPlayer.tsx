import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyPhoto } from "@/components/shared/PropertyPhoto";
import { cn } from "@/lib/utils";
import type { PropertyKind, PropertyPhoto as Photo } from "@/types/domain";

/**
 * Anteprima del Reel (Fase 1: simulata nel browser, nessun video vero).
 * Struttura: avatar del titolare che parla (intro) → foto REALI dell'immobile con soli movimenti
 * di camera (zoom lento, panoramica, parallasse leggera) → avatar (chiusura) con logo e contatti.
 * Le foto non vengono mai modificate o generate: si spostano e si ingrandiscono, nient'altro.
 */
export function ReelPlayer({
  photos,
  kind = "appartamento",
  tint = 20,
  intro,
  outro,
  duration,
  avatarName,
  agencyName,
  agencyPhone,
  address,
  className,
}: {
  photos: Photo[];
  kind?: PropertyKind;
  tint?: number;
  intro: string;
  outro: string;
  duration: number;
  avatarName: string;
  agencyName: string;
  agencyPhone?: string | null;
  address: string;
  className?: string;
}) {
  const segments = useMemo(() => buildTimeline(intro, outro, photos.length, duration), [intro, outro, photos.length, duration]);
  const total = segments.at(-1)?.end ?? duration;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    let raf = 0;
    const step = (now: number) => {
      if (last.current != null) {
        const dt = (now - last.current) / 1000;
        setT((x) => {
          const next = x + dt;
          if (next >= total) {
            setPlaying(false);
            return total;
          }
          return next;
        });
      }
      last.current = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  const index = Math.max(0, segments.findIndex((s) => t < s.end));
  const seg = t >= total ? segments.at(-1)! : segments[index];
  const local = Math.min(1, (t - seg.start) / (seg.end - seg.start));

  function toggle() {
    if (t >= total) setT(0);
    setPlaying((p) => !p);
  }

  return (
    <div className={cn("mx-auto w-full max-w-[340px]", className)}>
      <div
        className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-foreground text-white shadow-raised"
        role="img"
        aria-label={`Anteprima del video di ${address}`}
      >
        {seg.kind === "foto" ? (
          <div key={seg.id} className="absolute inset-0 overflow-hidden">
            <div
              className="h-full w-full"
              style={{
                animation: `${MOVES[seg.photo % MOVES.length]} ${seg.end - seg.start}s linear both`,
                animationPlayState: playing ? "running" : "paused",
              }}
            >
              <PropertyPhoto photo={photos[seg.photo]} kind={kind} tint={tint} alt="" className="h-full w-full object-cover" />
            </div>
            {seg.photo === 0 && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-14 pt-16">
                <p className="text-lg font-bold leading-tight drop-shadow">{address}</p>
              </div>
            )}
          </div>
        ) : (
          <AvatarScene key={seg.id} name={avatarName} playing={playing} />
        )}

        {/* Sottotitoli parola per parola durante l'avatar */}
        {seg.kind !== "foto" && <Subtitles text={seg.kind === "intro" ? intro : outro} progress={local} />}

        {/* Cartello finale con agenzia e contatti */}
        {seg.kind === "chiusura" && local > 0.7 && (
          <div className="absolute inset-x-4 top-1/3 rounded-xl bg-background/95 px-4 py-5 text-center text-foreground shadow-raised">
            <p className="text-xl font-extrabold tracking-tight">{agencyName}</p>
            {agencyPhone && <p className="mt-1 text-[17px] font-semibold text-primary-strong">{agencyPhone}</p>}
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[13px] font-semibold">Anteprima simulata</span>
        <div className="absolute inset-x-3 top-12 flex gap-1" aria-hidden>
          {segments.map((s, i) => (
            <span key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full bg-white"
                style={{ width: `${i < index || t >= total ? 100 : i === index ? local * 100 : 0}%` }}
              />
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={toggle}>
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          {playing ? "Pausa" : t > 0 && t < total ? "Riprendi" : "Guarda il video"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setT(0);
            setPlaying(true);
          }}
        >
          <RotateCcw aria-hidden />
          Dall'inizio
        </Button>
      </div>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {Math.round(total)} secondi · {photos.length} foto reali · avatar di {avatarName}
      </p>
    </div>
  );
}

const MOVES = ["kb-zoom-in", "kb-pan-left", "kb-parallax", "kb-zoom-out", "kb-pan-right"];

type Segment = { id: string; start: number; end: number } & ({ kind: "intro" | "chiusura" } | { kind: "foto"; photo: number });

/** Durata delle parti: le frasi dell'avatar a circa 2,6 parole al secondo, le foto si dividono il resto */
export function buildTimeline(intro: string, outro: string, photoCount: number, duration: number): Segment[] {
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const introSec = clamp(words(intro) / 2.6, 3, 14);
  const outroSec = clamp(words(outro) / 2.6, 3, 12);
  const n = Math.max(1, photoCount);
  const perPhoto = Math.max(2.5, (duration - introSec - outroSec) / n);
  const out: Segment[] = [{ id: "intro", kind: "intro", start: 0, end: introSec }];
  let at = introSec;
  for (let i = 0; i < n; i++) {
    out.push({ id: `foto-${i}`, kind: "foto", photo: i, start: at, end: at + perPhoto });
    at += perPhoto;
  }
  out.push({ id: "chiusura", kind: "chiusura", start: at, end: at + outroSec });
  return out;
}

/** Stima della durata finale (mostrata nel riepilogo) */
export function estimateSeconds(intro: string, outro: string, photoCount: number, duration: number) {
  return Math.round(buildTimeline(intro, outro, photoCount, duration).at(-1)!.end);
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function Subtitles({ text, progress }: { text: string; progress: number }) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const current = Math.min(words.length - 1, Math.floor(progress * words.length));
  const start = Math.max(0, current - (current % 5));
  const shown = words.slice(start, start + 5);
  return (
    <p className="absolute inset-x-4 bottom-16 text-center text-[19px] font-extrabold leading-snug [text-shadow:0_2px_6px_rgba(0,0,0,.6)]">
      {shown.map((w, i) => (
        <span key={start + i} className={cn(start + i === current && "text-[#F2A487]", start + i > current && "opacity-40")}>
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

/** Segnaposto dell'avatar: in Fase 2 qui ci sarà il video generato da HeyGen */
function AvatarScene({ name, playing }: { name: string; playing: boolean }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#2A3A52] to-foreground">
      <svg
        viewBox="0 0 200 300"
        className="absolute inset-x-0 bottom-0 mx-auto h-[78%]"
        style={{ animation: "avatar-breathe 3s ease-in-out infinite", animationPlayState: playing ? "running" : "paused" }}
        aria-hidden
      >
        <circle cx="100" cy="92" r="46" fill="#E9D6C8" />
        <path d="M54 84c0-30 20-48 46-48s46 18 46 48c-10-14-26-20-46-20s-36 6-46 20z" fill="#3B2A22" />
        <path d="M18 300c4-74 38-112 82-112s78 38 82 112z" fill="#C4532F" />
        <path d="M82 190l18 30 18-30z" fill="#F6F4F0" />
      </svg>
      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/45 px-3 py-1 text-[13px]">
        Avatar AI di {name}
      </span>
    </div>
  );
}
