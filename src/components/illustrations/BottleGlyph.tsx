const accentMap = {
  olive: { base: "var(--color-olive-500)", deep: "var(--color-olive-700)", label: "var(--color-olive-800)" },
  gold: { base: "var(--color-gold-500)", deep: "var(--color-gold-600)", label: "var(--color-gold-600)" },
  clay: { base: "var(--color-clay-500)", deep: "var(--color-clay-600)", label: "var(--color-clay-600)" },
  forest: { base: "var(--color-forest-700)", deep: "var(--color-forest-900)", label: "var(--color-forest-900)" },
} as const;

export type Accent = keyof typeof accentMap;

export function BottleGlyph({
  accent = "olive",
  className = "",
}: {
  accent?: Accent;
  className?: string;
}) {
  const colors = accentMap[accent];
  const gradId = `bottle-grad-${accent}`;
  const shadowId = `bottle-shadow-${accent}`;

  return (
    <svg
      viewBox="0 0 200 400"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors.base} stopOpacity="0.22" />
          <stop offset="100%" stopColor={colors.base} stopOpacity="0.05" />
        </linearGradient>
        <filter id={shadowId} x="-50%" y="-20%" width="200%" height="150%">
          <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor={colors.deep} floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter={`url(#${shadowId})`}>
        {/* Corpo bottiglia — spalle morbide, silhouette arrotondata */}
        <path
          d="M78 10H122V44C122 49 125 53 129 57C144 71 154 91 154 113V344C154 361 140 375 123 375H77C60 375 46 361 46 344V113C46 91 56 71 71 57C75 53 78 49 78 44V10Z"
          fill="var(--color-paper)"
          stroke={colors.base}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Velatura di colore sul corpo */}
        <path
          d="M46 158H154V344C154 361 140 375 123 375H77C60 375 46 361 46 344V158Z"
          fill={`url(#${gradId})`}
        />
        {/* Etichetta arrotondata */}
        <rect
          x="58"
          y="182"
          width="84"
          height="94"
          rx="10"
          fill="var(--color-paper)"
          stroke={colors.label}
          strokeWidth="1.5"
          opacity="0.95"
        />
        <line x1="70" y1="206" x2="130" y2="206" stroke={colors.label} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="70" y1="218" x2="118" y2="218" stroke={colors.label} strokeWidth="1" strokeLinecap="round" opacity="0.55" />
        <line x1="70" y1="252" x2="106" y2="252" stroke={colors.label} strokeWidth="1" strokeLinecap="round" opacity="0.55" />

        {/* Tappo arrotondato */}
        <rect x="74" y="0" width="52" height="18" rx="9" fill={colors.deep} />

        {/* Riflesso lucido */}
        <path
          d="M64 130C64 170 62 250 62 320"
          stroke="var(--color-paper)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.35"
        />
      </g>
    </svg>
  );
}
