import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** "light" = su fondo chiaro, "dark" = su fondo scuro. */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  href?: string | null;
  className?: string;
};

const sizes = {
  sm: { word: "text-base", sub: "text-[9px]" },
  md: { word: "text-xl", sub: "text-[10px]" },
  lg: { word: "text-3xl", sub: "text-xs" },
};

/**
 * Logo testuale provvisorio. Per usare il PNG ufficiale sostituisci il contenuto di <LogoMark>
 * con <Image src="/logo-nexora.png" ... /> lasciando invariata l'interfaccia del componente.
 */
export function Logo({ tone = "light", size = "md", href = "/", className }: LogoProps) {
  const mark = <LogoMark tone={tone} size={size} className={className} />;
  if (!href) return mark;
  return (
    <Link href={href} aria-label="Nexora Academy, vai alla home" className="inline-flex rounded-sm">
      {mark}
    </Link>
  );
}

function LogoMark({
  tone,
  size,
  className,
}: Required<Pick<LogoProps, "tone" | "size">> & { className?: string }) {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span
        className={cn(
          "font-display tracking-[0.12em]",
          sizes[size].word,
          tone === "dark" ? "text-white" : "text-ink",
        )}
      >
        NEXORA
      </span>
      <span
        className={cn(
          "mt-1 font-semibold tracking-[0.42em]",
          sizes[size].sub,
          tone === "dark" ? "text-nexora-blue-bright" : "text-nexora-blue",
        )}
      >
        ACADEMY
      </span>
    </span>
  );
}
