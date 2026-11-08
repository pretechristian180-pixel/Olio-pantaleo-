import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Monogramma CP (marchio Christian Prete): C sfumata blu-ciano con piste a circuito.
 * Si legge su fondo scuro e chiaro.
 */
export function NexoraMark({
  className,
  title = "Christian Prete",
}: {
  className?: string;
  title?: string | null;
}) {
  const id = useId();
  const blue = `${id}-blue`;
  return (
    <svg
      viewBox="10 4 100 112"
      className={cn("h-8 w-auto shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title ?? undefined}
    >
      <defs>
        <linearGradient id={blue} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#45d9ff" />
          <stop offset=".55" stopColor="#3d7bff" />
          <stop offset="1" stopColor="#1d3fb8" />
        </linearGradient>
      </defs>
      <path fill={`url(#${blue})`} d="M74 14 H40 L16 38 V82 L40 106 H74 V88 H48 L34 74 V46 L48 32 H74 Z" />
      <g fill="none" stroke="currentColor" strokeLinejoin="round">
        <path d="M74 23 H86 L96 13 M74 97 H86 L96 107 M50 60 H92" strokeWidth="5" />
        <circle cx="100" cy="10" r="5" strokeWidth="4" />
        <circle cx="100" cy="110" r="5" strokeWidth="4" />
      </g>
      <circle cx="99" cy="60" r="7" fill="#45d9ff" />
    </svg>
  );
}

/** Scritta CHRISTIAN PRETE nel lettering largo Michroma. */
export function NexoraWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-wordmark text-[0.95em] leading-none tracking-[0.12em] whitespace-nowrap text-foreground uppercase",
        className,
      )}
    >
      Christian Prete
    </span>
  );
}

/** Logo completo per header e pagine di accesso: monogramma CP + CHRISTIAN PRETE + "Studio". */
export function NexoraLogo({
  className,
  showProduct = true,
}: {
  className?: string;
  showProduct?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <NexoraMark className="h-8 text-foreground" title={null} />
      <span className="flex flex-col gap-1" aria-hidden>
        <NexoraWordmark className="text-sm" />
        {showProduct && (
          <span className="text-[0.625rem] font-semibold tracking-[0.3em] text-nx-cyan-400 uppercase">
            Studio
          </span>
        )}
      </span>
      <span className="sr-only">Christian Prete Studio</span>
    </span>
  );
}
