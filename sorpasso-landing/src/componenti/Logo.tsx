/**
 * Logo ufficiale Sorpasso AI. Su fondo scuro la versione chiara (testo bianco, "S" e "AI" blu elettrico);
 * public/logo-scuro.png è la versione per fondi chiari.
 */
export function Logo({ className = "", altezza = 36 }: { className?: string; altezza?: number }) {
  return (
    <img
      src="/logo-chiaro.png"
      alt="Sorpasso AI"
      width={Math.round(altezza * 5.3)}
      height={altezza}
      className={`block h-auto shrink-0 ${className}`}
      style={{ height: altezza, width: "auto" }}
      decoding="async"
    />
  );
}
