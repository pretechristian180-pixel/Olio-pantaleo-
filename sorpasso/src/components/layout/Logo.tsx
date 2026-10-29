import { cn } from "@/lib/utils";

/**
 * Logo ufficiale Sorpasso AI.
 * `invert` = versione chiara (testo bianco) per fondi scuri come il menu laterale;
 * senza `invert` la versione originale blu notte per fondi chiari.
 */
export function Logo({ className, invert, altezza = 28 }: { className?: string; invert?: boolean; altezza?: number }) {
  // Contenitore inline: in una colonna flex l'immagine non viene stirata in larghezza.
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <img
        src={invert ? "/logo-chiaro.png" : "/logo-scuro.png"}
        alt="Sorpasso AI"
        width={Math.round(altezza * 5.3)}
        height={altezza}
        style={{ height: altezza, width: "auto" }}
        className="block max-w-none object-contain"
        decoding="async"
      />
    </span>
  );
}
