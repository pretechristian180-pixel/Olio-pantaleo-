"use client";

import { useEffect, useRef, useState } from "react";
import type { TimelineEvent } from "@/lib/data/timeline";

export function StoryTimeline({ events }: { events: TimelineEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const total = rect.height - viewportH * 0.5;
      const scrolled = viewportH * 0.5 - rect.top;
      const pct = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
      setProgress(pct);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className="absolute left-[7px] top-2 w-[2px] bg-sand sm:left-[11px]"
        style={{ height: "calc(100% - 1rem)" }}
        aria-hidden="true"
      >
        <div
          className="w-full bg-olive-600 transition-[height] duration-150 ease-out"
          style={{ height: `${progress * 100}%` }}
        />
      </div>

      <ol className="space-y-20">
        {events.map((event, i) => (
          <TimelineItem key={event.year} event={event} index={i} />
        ))}
      </ol>
    </div>
  );
}

function TimelineItem({ event, index }: { event: TimelineEvent; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <li
      ref={ref}
      className={`relative pl-8 transition-all duration-700 ease-out sm:pl-12 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      <span
        className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 sm:h-6 sm:w-6 ${
          visible ? "border-olive-600 bg-gold-500" : "border-stone bg-paper"
        }`}
        aria-hidden="true"
      />
      <p className="font-serif text-3xl text-olive-800 sm:text-4xl">{event.year}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.25em] text-clay-600">{event.eyebrow}</p>
      <h3 className="mt-3 font-serif text-2xl text-ink">{event.title}</h3>
      <p className="mt-3 max-w-xl text-bark">{event.text}</p>
    </li>
  );
}
