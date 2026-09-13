/**
 * Divisore organico tra sezioni: sostituisce il taglio netto orizzontale
 * con un'onda morbida. `fill="currentColor"` prende il colore della
 * sezione successiva (quella verso cui la curva "versa").
 */
export function SectionCurve({
  className = "",
  flip = false,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={`${className} ${flip ? "rotate-180" : ""}`}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0,64 C 240,110 480,8 720,32 C 960,56 1080,116 1440,54 L1440,120 L0,120 Z"
        fill="currentColor"
      />
    </svg>
  );
}
