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
  sm: { word: "text-base", sub: "text-[10px]", img: "h-7" },
  md: { word: "text-[22px]", sub: "text-[11px]", img: "h-9" },
  lg: { word: "text-3xl", sub: "text-xs", img: "h-12" },
};

/**
 * Logo dell'academy corrente: l'immagine caricata dal cliente oppure il nome in Michroma.
 * Per Nexora è il testo "NEXORA"; il PNG ufficiale si imposta dal pannello Marchio.
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
        inline ? "flex-row items-baseline gap-3" : "flex-col gap-1.5",
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
            sizes[size].sub,
            tone === "dark" ? "text-nexora-blue-bright" : "text-nexora-blue",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
