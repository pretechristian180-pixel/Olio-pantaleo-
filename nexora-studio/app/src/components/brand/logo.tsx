import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Marchio "N" di Nexora in vettoriale (ricostruito dal logo ufficiale).
 * Blu elettrico a sinistra, argento metallico a destra.
 */
export function NexoraMark({
  className,
  title = "Nexora",
}: {
  className?: string;
  title?: string | null;
}) {
  const id = useId();
  const blue = `${id}-blue`;
  const silver = `${id}-silver`;
  return (
    <svg
      viewBox="250 295 750 632"
      className={cn("h-8 w-auto shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title ?? undefined}
    >
      <defs>
        <linearGradient
          id={blue}
          x1="262"
          y1="327"
          x2="700"
          y2="900"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#1aa8ff" />
          <stop offset=".25" stopColor="#0063fc" />
          <stop offset="1" stopColor="#0028d0" />
        </linearGradient>
        <linearGradient
          id={silver}
          x1="988"
          y1="305"
          x2="700"
          y2="890"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".55" stopColor="#b9b9bc" />
          <stop offset="1" stopColor="#7c7d82" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${blue})`}
        d="M262 345q0-18 18-18h180q18 0 32 13L815 650 600 640 420 485q-8-7-18-7h-12v437L268 793q-6-6-6-15z"
      />
      <path
        fill={`url(#${silver})`}
        d="M600 640q90-12 170 8l92 92V430q0-10 8-18l118-107v545q0 40-40 40h-110q-18 0-32-13z"
      />
    </svg>
  );
}

/** Scritta NEXORA nel lettering largo del logo, con la X in blu. */
export function NexoraWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-wordmark text-[0.95em] leading-none tracking-[0.32em] text-foreground uppercase",
        className,
      )}
    >
      NE<span className="text-nx-blue-500">X</span>ORA
    </span>
  );
}

/** Logo completo per header e pagine di accesso: marchio + NEXORA + "Studio". */
export function NexoraLogo({
  className,
  showProduct = true,
}: {
  className?: string;
  showProduct?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <NexoraMark className="h-7" title={null} />
      <span className="flex flex-col gap-1" aria-hidden>
        <NexoraWordmark className="text-sm" />
        {showProduct && (
          <span className="text-[0.625rem] font-medium tracking-[0.3em] text-muted-foreground uppercase">
            Studio
          </span>
        )}
      </span>
      <span className="sr-only">Nexora Studio</span>
    </span>
  );
}
