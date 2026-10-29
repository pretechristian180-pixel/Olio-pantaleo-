import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Art = "casa" | "persone" | "calendario" | "trattative" | "fatto" | "ricerca";

/** Stato vuoto amichevole: illustrazione semplice, una frase e (di solito) un pulsante. */
export function EmptyState({
  art,
  title,
  text,
  action,
  className,
}: {
  art: Art;
  title: string;
  text?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <Illustration art={art} />
      <h3 className="mt-6 text-xl font-semibold">{title}</h3>
      {text && <p className="mt-2 max-w-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-6 w-full max-w-xs [&>*]:w-full">{action}</div>}
    </div>
  );
}

function Illustration({ art }: { art: Art }) {
  return (
    <svg viewBox="0 0 160 120" className="h-28 w-36" aria-hidden>
      <ellipse cx="80" cy="108" rx="58" ry="7" fill="#F8E9E3" />
      <circle cx="80" cy="58" r="46" fill="#EEEAE3" />
      {art === "casa" && (
        <g>
          <path d="M48 62 80 36l32 26v38H48z" fill="#fff" stroke="#C4532F" strokeWidth="3" strokeLinejoin="round" />
          <rect x="70" y="72" width="20" height="28" rx="2" fill="#F8E9E3" stroke="#C4532F" strokeWidth="3" />
          <circle cx="116" cy="34" r="12" fill="#C4532F" />
          <path d="M116 28v12M110 34h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {art === "persone" && (
        <g stroke="#C4532F" strokeWidth="3" fill="#fff">
          <circle cx="66" cy="50" r="12" />
          <path d="M44 92c0-14 10-22 22-22s22 8 22 22z" strokeLinejoin="round" />
          <circle cx="100" cy="56" r="10" fill="#F8E9E3" />
          <path d="M84 92c2-11 8-17 16-17s16 6 18 17z" fill="#F8E9E3" strokeLinejoin="round" />
        </g>
      )}
      {art === "calendario" && (
        <g>
          <rect x="46" y="34" width="68" height="62" rx="8" fill="#fff" stroke="#C4532F" strokeWidth="3" />
          <path d="M46 52h68" stroke="#C4532F" strokeWidth="3" />
          <path d="M62 28v12M98 28v12" stroke="#C4532F" strokeWidth="3" strokeLinecap="round" />
          <rect x="58" y="62" width="12" height="10" rx="2" fill="#F8E9E3" />
          <rect x="74" y="62" width="12" height="10" rx="2" fill="#C4532F" />
          <rect x="90" y="62" width="12" height="10" rx="2" fill="#F8E9E3" />
          <rect x="58" y="78" width="12" height="10" rx="2" fill="#F8E9E3" />
        </g>
      )}
      {art === "trattative" && (
        <g>
          {[40, 68, 96].map((x, i) => (
            <g key={x}>
              <rect x={x} y="32" width="24" height="64" rx="5" fill="#fff" stroke="#D3CCC0" strokeWidth="2" />
              <rect x={x + 4} y={38 + i * 8} width="16" height="14" rx="3" fill={i === 1 ? "#C4532F" : "#F8E9E3"} />
            </g>
          ))}
        </g>
      )}
      {art === "fatto" && (
        <g>
          <circle cx="80" cy="60" r="30" fill="#fff" stroke="#1F7A43" strokeWidth="3" />
          <path d="m66 60 10 10 20-20" fill="none" stroke="#1F7A43" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {art === "ricerca" && (
        <g>
          <circle cx="74" cy="54" r="22" fill="#fff" stroke="#C4532F" strokeWidth="3" />
          <path d="m90 70 18 18" stroke="#C4532F" strokeWidth="5" strokeLinecap="round" />
          <path d="M66 54h16" stroke="#D3CCC0" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
