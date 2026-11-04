"use client";

import { createContext, useCallback, useContext, useRef } from "react";

type PlayerApi = {
  /** Secondo corrente del video (aggiornato dal player). */
  currentTime: React.RefObject<number>;
  seek: (seconds: number) => void;
  /** Registrato dal componente video. */
  registerSeek: (fn: (seconds: number) => void) => void;
};

const Ctx = createContext<PlayerApi | null>(null);

export function PlayerProvider({
  children,
  startAt = 0,
}: {
  children: React.ReactNode;
  startAt?: number;
}) {
  const currentTime = useRef(startAt);
  const seekFn = useRef<(s: number) => void>(() => {});
  const seek = useCallback((s: number) => seekFn.current(s), []);
  const registerSeek = useCallback((fn: (s: number) => void) => {
    seekFn.current = fn;
  }, []);
  return <Ctx.Provider value={{ currentTime, seek, registerSeek }}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer va usato dentro <PlayerProvider>");
  return ctx;
}
