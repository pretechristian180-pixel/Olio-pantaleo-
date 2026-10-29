import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Art = "auto" | "persone" | "calendario" | "lead" | "fatto" | "ricerca" | "pratiche" | "grafico";

/** Stato vuoto: illustrazione semplice, una frase e un'azione chiara. */
export function EmptyState({
  art,
  title,
  text,
  action,
  className,
  compact,
}: {
  art: Art;
  title: string;
  text?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 text-center", compact ? "py-6" : "py-12", className)}>
      <Illustration art={art} small={compact} />
      <h3 className={cn("font-semibold", compact ? "mt-3 text-lg" : "mt-6 text-xl")}>{title}</h3>
      {text && <p className="mt-2 max-w-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-6 w-full max-w-xs [&>*]:w-full">{action}</div>}
    </div>
  );
}

const A = "#3D6BFF";
const N = "#0B1530";
const S = "#EBF1FF";

function Illustration({ art, small }: { art: Art; small?: boolean }) {
  return (
    <svg viewBox="0 0 160 120" className={small ? "h-16 w-20" : "h-28 w-36"} aria-hidden>
      <ellipse cx="80" cy="108" rx="58" ry="7" fill={S} />
      <circle cx="80" cy="58" r="46" fill="#F4F6FA" />
      {art === "auto" && (
        <g>
          <path d="M38 78v-10l10-16c2-3 5-5 9-5h40c4 0 7 2 9 5l12 16v10z" fill="#fff" stroke={N} strokeWidth="3" strokeLinejoin="round" />
          <path d="M54 52h48l9 14H46z" fill={S} />
          <circle cx="56" cy="80" r="9" fill={N} />
          <circle cx="104" cy="80" r="9" fill={N} />
          <circle cx="118" cy="34" r="12" fill={A} />
          <path d="M118 28v12M112 34h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {art === "persone" && (
        <g stroke={N} strokeWidth="3" fill="#fff">
          <circle cx="66" cy="50" r="12" />
          <path d="M44 92c0-14 10-22 22-22s22 8 22 22z" strokeLinejoin="round" />
          <circle cx="100" cy="56" r="10" fill={S} stroke={A} />
          <path d="M84 92c2-11 8-17 16-17s16 6 18 17z" fill={S} stroke={A} strokeLinejoin="round" />
        </g>
      )}
      {art === "calendario" && (
        <g>
          <rect x="46" y="34" width="68" height="62" rx="8" fill="#fff" stroke={N} strokeWidth="3" />
          <path d="M46 52h68" stroke={N} strokeWidth="3" />
          <path d="M62 28v12M98 28v12" stroke={N} strokeWidth="3" strokeLinecap="round" />
          <rect x="58" y="62" width="12" height="10" rx="2" fill={S} />
          <rect x="74" y="62" width="12" height="10" rx="2" fill={A} />
          <rect x="90" y="62" width="12" height="10" rx="2" fill={S} />
          <rect x="58" y="78" width="12" height="10" rx="2" fill={S} />
        </g>
      )}
      {art === "lead" && (
        <g>
          {[40, 68, 96].map((x, i) => (
            <g key={x}>
              <rect x={x} y="32" width="24" height="64" rx="5" fill="#fff" stroke="#D5DBE5" strokeWidth="2" />
              <rect x={x + 4} y={38 + i * 8} width="16" height="14" rx="3" fill={i === 1 ? A : S} />
            </g>
          ))}
        </g>
      )}
      {art === "fatto" && (
        <g>
          <circle cx="80" cy="60" r="30" fill="#fff" stroke="#15803D" strokeWidth="3" />
          <path d="m66 60 10 10 20-20" fill="none" stroke="#15803D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {art === "ricerca" && (
        <g>
          <circle cx="74" cy="54" r="22" fill="#fff" stroke={N} strokeWidth="3" />
          <path d="m90 70 18 18" stroke={A} strokeWidth="5" strokeLinecap="round" />
          <path d="M66 54h16" stroke="#D5DBE5" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {art === "pratiche" && (
        <g>
          <rect x="52" y="28" width="56" height="70" rx="6" fill="#fff" stroke={N} strokeWidth="3" />
          {[44, 58, 72].map((y, i) => (
            <g key={y}>
              <rect x="60" y={y} width="10" height="10" rx="2" fill={i < 2 ? A : S} />
              <path d={`M76 ${y + 5}h24`} stroke="#D5DBE5" strokeWidth="3" strokeLinecap="round" />
            </g>
          ))}
        </g>
      )}
      {art === "grafico" && (
        <g>
          <rect x="50" y="64" width="12" height="30" rx="2" fill={S} />
          <rect x="68" y="50" width="12" height="44" rx="2" fill={N} />
          <rect x="86" y="38" width="12" height="56" rx="2" fill={A} />
          <path d="M44 94h72" stroke="#D5DBE5" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
