"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTenantUi } from "@/components/tenant/tenant-context";

type LogoProps = {
  /** "light" = su fondo chiaro, "dark" = su fondo scuro. */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  /** "stacked" = ACADEMY sotto (sidebar), "inline" = ACADEMY accanto (header pubblico). */
  layout?: "stacked" | "inline";
  /** Testo del sopratitolo, es. "ACADEMY · ADMIN". Vuoto = niente sopratitolo. */
  label?: string;
  href?: string | null;
  className?: string;
};

const sizes = {
  sm: { word: "text-base", sub: "text-[10px]", img: "h-7", mark: "size-7", cp: "text-[13px]" },
  md: { word: "text-[22px]", sub: "text-[11px]", img: "h-9", mark: "size-9", cp: "text-[15px]" },
  lg: { word: "text-3xl", sub: "text-xs", img: "h-12", mark: "size-12", cp: "text-xl" },
};

/** Monogramma CP (marchio Christian Prete): C sfumata con piste a circuito. */
function CpMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="cp-mark-g" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#45d9ff" />
          <stop offset="0.55" stopColor="#3d7bff" />
          <stop offset="1" stopColor="#1d3fb8" />
        </linearGradient>
      </defs>
      <path d="M74 14 H40 L16 38 V82 L40 106 H74 V88 H48 L34 74 V46 L48 32 H74 Z" fill="url(#cp-mark-g)" />
      <path d="M74 23 H86 L96 13 M74 97 H86 L96 107 M50 60 H92" fill="none" stroke="#e9eef9" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="100" cy="10" r="6" fill="none" stroke="#e9eef9" strokeWidth="4" />
      <circle cx="100" cy="110" r="6" fill="none" stroke="#e9eef9" strokeWidth="4" />
      <circle cx="99" cy="60" r="7" fill="#45d9ff" />
    </svg>
  );
}

/**
 * Logo dell'academy corrente: l'immagine caricata dal cliente oppure il nome in Michroma.
 * Per l'academy principale è il monogramma CP con "CHRISTIAN PRETE"; le altre academy usano il loro nome o logo.
 */
export function Logo({ href = "/", ...props }: LogoProps) {
  const tenant = useTenantUi();
  const mark = <LogoMark {...props} />;
  if (!href) return mark;
  return (
    <Link
      href={href}
      aria-label={`${tenant.nome}, vai alla home`}
      className="inline-flex rounded-sm"
    >
      {mark}
    </Link>
  );
}

function LogoMark({
  tone = "light",
  size = "md",
  layout = "stacked",
  label = "ACADEMY",
  className,
}: Omit<LogoProps, "href">) {
  const tenant = useTenantUi();
  const inline = layout === "inline";
  return (
    <span
      className={cn(
        "inline-flex leading-none",
        inline ? "flex-row items-center gap-3" : "flex-col gap-1.5",
        className,
      )}
    >
      {tenant.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tenant.logoUrl}
          alt={tenant.nome}
          className={cn("w-auto max-w-48 object-contain", sizes[size].img)}
        />
      ) : tenant.isNexora ? (
        <span className="inline-flex items-center gap-2.5">
          <CpMark className={sizes[size].mark} />
          <span
            className={cn(
              "font-display tracking-[0.06em] whitespace-nowrap",
              inline && "max-sm:text-[13px]",
              sizes[size].cp,
              tone === "dark" ? "text-white" : "text-ink",
            )}
          >
            CHRISTIAN PRETE
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "font-display tracking-[0.04em]",
            sizes[size].word,
            tone === "dark" ? "text-white" : "text-ink",
          )}
        >
          {tenant.logoText}
        </span>
      )}
      {label && (
        <span
          className={cn(
            "font-semibold tracking-[0.32em] whitespace-nowrap",
            inline && "hidden sm:inline",
            sizes[size].sub,
            tone === "dark" ? "text-nexora-blue-bright" : "text-nexora-blue-bright",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
