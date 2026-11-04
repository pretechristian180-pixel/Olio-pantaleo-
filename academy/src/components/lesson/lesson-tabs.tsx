"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: string;
  content: React.ReactNode;
  /** Visibile solo sotto i 1024px (es. il programma, che su desktop sta nella colonna destra). */
  mobileOnly?: boolean;
};

/** Schede accessibili (frecce sinistra/destra, Home, Fine). */
export function LessonTabs({ items: all }: { items: TabItem[] }) {
  const base = useId();
  const [mobile, setMobile] = useState(false);
  const items = mobile ? all : all.filter((t) => !t.mobileOnly);
  const [chosen, setChosen] = useState<string | undefined>();
  const active = items.some((t) => t.id === chosen) ? chosen : items[0]?.id;
  const setActive = setChosen;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function onKey(e: React.KeyboardEvent, i: number) {
    const last = items.length - 1;
    const to =
      e.key === "ArrowRight"
        ? i === last
          ? 0
          : i + 1
        : e.key === "ArrowLeft"
          ? i === 0
            ? last
            : i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (to === null) return;
    e.preventDefault();
    setActive(items[to]!.id);
    refs.current[to]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Contenuti della lezione"
        className="flex gap-6 overflow-x-auto border-b border-line px-4 md:px-0"
      >
        {items.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "-mb-px flex min-h-12 shrink-0 items-center border-b-2 text-[15px] font-semibold whitespace-nowrap",
                selected
                  ? "border-nexora-blue text-nexora-blue"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {items.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          className="px-4 py-6 focus:outline-none md:px-0"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
