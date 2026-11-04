import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** "light" = su fondo chiaro, "dark" = su fondo scuro. */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  /** "stacked" = ACADEMY sotto (sidebar), "inline" = ACADEMY accanto (header pubblico). */
  layout?: "stacked" | "inline";
  /** Testo del sopratitolo, es. "ACADEMY · ADMIN". */
  label?: string;
  href?: string | null;
  className?: string;
};

const sizes = {
  sm: { word: "text-base", sub: "text-[10px]" },
  md: { word: "text-[22px]", sub: "text-[11px]" },
  lg: { word: "text-3xl", sub: "text-xs" },
};

/**
 * Logo testuale provvisorio. Per usare il PNG ufficiale sostituisci il contenuto di <LogoMark>
 * con <Image src="/logo-nexora.png" ... /> lasciando invariata l'interfaccia del componente.
 */
export function Logo({ href = "/", ...props }: LogoProps) {
  const mark = <LogoMark {...props} />;
  if (!href) return mark;
  return (
    <Link href={href} aria-label="Nexora Academy, vai alla home" className="inline-flex rounded-sm">
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
  const inline = layout === "inline";
  return (
    <span
      className={cn(
        "inline-flex leading-none",
        inline ? "flex-row items-baseline gap-3" : "flex-col gap-1.5",
        className,
      )}
    >
      <span
        className={cn(
          "font-display tracking-[0.04em]",
          sizes[size].word,
          tone === "dark" ? "text-white" : "text-ink",
        )}
      >
        NEXORA
      </span>
      <span
        className={cn(
          "font-semibold tracking-[0.32em] whitespace-nowrap",
          sizes[size].sub,
          tone === "dark" ? "text-nexora-blue-bright" : "text-nexora-blue",
        )}
      >
        {label}
      </span>
    </span>
  );
}
