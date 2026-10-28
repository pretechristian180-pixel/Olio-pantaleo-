import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PropertyKind, PropertyPhoto as Photo } from "@/types/domain";

/**
 * Foto dell'immobile. Se manca l'url (dati finti) disegna un'illustrazione
 * segnaposto coerente con il tipo di immobile e la stanza.
 */
export function PropertyPhoto({
  photo,
  kind,
  tint,
  alt,
  className,
}: {
  photo?: Photo;
  kind: PropertyKind;
  tint: number;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (photo?.url && !failed) {
    return (
      <img
        src={photo.url}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return <PropertyArt scene={photo?.scene ?? "esterno"} kind={kind} tint={tint} alt={alt} className={className} />;
}

function PropertyArt({
  scene,
  kind,
  tint,
  alt,
  className,
}: {
  scene: Photo["scene"];
  kind: PropertyKind;
  tint: number;
  alt: string;
  className?: string;
}) {
  const h = tint;
  const c = {
    skyTop: `hsl(${h} 70% 86%)`,
    skyBottom: `hsl(${(h + 30) % 360} 60% 94%)`,
    wall: `hsl(${h} 25% 95%)`,
    wallDark: `hsl(${h} 18% 88%)`,
    accent: `hsl(${h} 45% 58%)`,
    accentSoft: `hsl(${h} 45% 78%)`,
    wood: "hsl(30 35% 62%)",
    stone: "hsl(40 30% 86%)",
    stoneDark: "hsl(38 22% 74%)",
    green: "hsl(110 25% 52%)",
    greenDark: "hsl(120 22% 40%)",
    floor: `hsl(${(h + 20) % 360} 15% 84%)`,
  };
  const id = `g${h}${scene}${kind}`;

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={alt}
      className={cn("h-full w-full", className)}
    >
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.skyTop} />
          <stop offset="1" stopColor={c.skyBottom} />
        </linearGradient>
      </defs>

      {scene === "esterno" && (
        <>
          <rect width="400" height="300" fill={`url(#${id}sky)`} />
          <circle cx="320" cy="62" r="26" fill="hsl(45 95% 85%)" />
          <path d="M0 240 Q100 215 200 232 T400 228 V300 H0Z" fill={c.green} opacity=".45" />
          {(kind === "appartamento" || kind === "attico") && (
            <g>
              <rect x="110" y="70" width="180" height="190" rx="4" fill={c.wall} />
              <rect x="110" y="70" width="180" height="14" fill={c.wallDark} />
              {[0, 1, 2, 3].map((r) =>
                [0, 1, 2].map((col) => (
                  <g key={`${r}${col}`}>
                    <rect x={130 + col * 52} y={98 + r * 40} width="34" height="24" rx="2" fill={c.accentSoft} />
                    <rect x={126 + col * 52} y={122 + r * 40} width="42" height="4" fill={c.wallDark} />
                  </g>
                )),
              )}
              {kind === "attico" && <rect x="150" y="48" width="100" height="22" rx="3" fill={c.wallDark} />}
              <rect x="186" y="226" width="28" height="34" rx="2" fill={c.wood} />
            </g>
          )}
          {(kind === "villa" || kind === "casa") && (
            <g>
              <rect x="90" y="140" width="220" height="110" rx="4" fill={c.wall} />
              <path d="M76 146 L200 82 L324 146Z" fill={c.accent} />
              <rect x="120" y="170" width="44" height="34" rx="2" fill={c.accentSoft} />
              <rect x="236" y="170" width="44" height="34" rx="2" fill={c.accentSoft} />
              <rect x="182" y="196" width="36" height="54" rx="2" fill={c.wood} />
              <circle cx="60" cy="226" r="26" fill={c.greenDark} />
              <circle cx="345" cy="220" r="30" fill={c.green} />
            </g>
          )}
          {kind === "trullo" && (
            <g>
              <rect x="70" y="170" width="260" height="80" rx="6" fill="hsl(40 30% 96%)" />
              {[110, 200, 290].map((x, i) => (
                <g key={x}>
                  <path d={`M${x - 46} 176 Q${x} ${i === 1 ? 70 : 96} ${x + 46} 176Z`} fill="hsl(30 8% 55%)" />
                  <circle cx={x} cy={i === 1 ? 86 : 108} r="6" fill="hsl(40 30% 96%)" />
                </g>
              ))}
              <rect x="186" y="206" width="28" height="44" rx="14" fill={c.wood} />
              <rect x="110" y="210" width="22" height="22" rx="11" fill={c.accentSoft} />
              <rect x="268" y="210" width="22" height="22" rx="11" fill={c.accentSoft} />
              <rect x="0" y="262" width="400" height="38" fill={c.accentSoft} opacity=".55" />
            </g>
          )}
          {kind === "masseria" && (
            <g>
              <rect x="40" y="130" width="320" height="120" fill={c.stone} />
              <rect x="150" y="96" width="100" height="40" fill={c.stoneDark} />
              {[60, 110, 270, 320].map((x) => (
                <rect key={x} x={x} y="160" width="26" height="36" rx="13" fill={c.wood} opacity=".75" />
              ))}
              <path d="M176 250 V196 a24 24 0 0 1 48 0 V250Z" fill={c.wood} />
              {[20, 380].map((x) => (
                <g key={x}>
                  <rect x={x - 4} y="214" width="8" height="40" fill="hsl(30 25% 40%)" />
                  <circle cx={x} cy="206" r="22" fill={c.greenDark} opacity=".85" />
                </g>
              ))}
            </g>
          )}
          <rect y="250" width="400" height="50" fill={c.greenDark} opacity=".25" />
        </>
      )}

      {scene === "vista" && (
        <>
          <rect width="400" height="180" fill={`url(#${id}sky)`} />
          <rect y="160" width="400" height="80" fill="hsl(198 60% 62%)" />
          <path d="M0 175 H400" stroke="white" strokeOpacity=".5" strokeWidth="2" />
          <path d="M30 200 H120 M200 215 H300" stroke="white" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
          <rect y="232" width="400" height="68" fill={c.stone} />
          {Array.from({ length: 21 }, (_, i) => (
            <rect key={i} x={i * 20} y="196" width="5" height="40" fill="white" opacity=".9" />
          ))}
          <rect y="192" width="400" height="7" fill="white" />
          <circle cx="330" cy="70" r="24" fill="hsl(45 95% 88%)" />
        </>
      )}

      {(scene === "soggiorno" || scene === "cucina" || scene === "camera") && (
        <>
          <rect width="400" height="300" fill={c.wall} />
          <rect y="226" width="400" height="74" fill={c.floor} />
          <rect x="250" y="40" width="110" height="130" rx="4" fill={`url(#${id}sky)`} stroke={c.wallDark} strokeWidth="8" />
          <path d="M305 40 V170" stroke={c.wallDark} strokeWidth="5" />
          {scene === "soggiorno" && (
            <g>
              <rect x="40" y="170" width="190" height="62" rx="14" fill={c.accent} />
              <rect x="52" y="146" width="166" height="44" rx="12" fill={c.accentSoft} />
              <rect x="60" y="232" width="8" height="12" fill={c.wood} />
              <rect x="202" y="232" width="8" height="12" fill={c.wood} />
              <rect x="70" y="76" width="90" height="56" rx="3" fill={c.wallDark} />
              <rect x="78" y="84" width="74" height="40" rx="2" fill={c.accentSoft} opacity=".6" />
              <rect x="250" y="210" width="90" height="10" rx="5" fill={c.wood} />
              <rect x="380" y="186" width="12" height="44" fill={c.wood} opacity=".6" />
              <circle cx="386" cy="170" r="22" fill={c.green} />
            </g>
          )}
          {scene === "cucina" && (
            <g>
              <rect x="20" y="150" width="220" height="80" rx="3" fill={c.wallDark} />
              <rect x="16" y="144" width="228" height="10" rx="2" fill={c.stone} />
              {[30, 102, 174].map((x) => (
                <rect key={x} x={x} y="164" width="58" height="56" rx="3" fill="white" opacity=".85" />
              ))}
              <rect x="30" y="56" width="200" height="56" rx="3" fill="white" opacity=".85" />
              <path d="M96 56 V112 M164 56 V112" stroke={c.wallDark} strokeWidth="3" />
              <rect x="268" y="196" width="90" height="34" rx="6" fill={c.wood} />
              <rect x="276" y="230" width="8" height="30" fill={c.wood} />
              <rect x="342" y="230" width="8" height="30" fill={c.wood} />
              <circle cx="120" cy="134" r="8" fill={c.accent} />
            </g>
          )}
          {scene === "camera" && (
            <g>
              <rect x="40" y="110" width="12" height="122" rx="3" fill={c.wood} />
              <rect x="40" y="110" width="200" height="60" rx="10" fill={c.wood} opacity=".55" />
              <rect x="46" y="166" width="196" height="64" rx="10" fill="white" />
              <rect x="52" y="182" width="190" height="48" rx="8" fill={c.accentSoft} />
              <rect x="58" y="146" width="70" height="28" rx="12" fill="white" stroke={c.wallDark} />
              <rect x="138" y="146" width="70" height="28" rx="12" fill="white" stroke={c.wallDark} />
              <rect x="254" y="186" width="48" height="46" rx="4" fill={c.wood} opacity=".8" />
              <path d="M270 186 L278 160 L286 186Z" fill={c.accent} />
            </g>
          )}
        </>
      )}
    </svg>
  );
}
