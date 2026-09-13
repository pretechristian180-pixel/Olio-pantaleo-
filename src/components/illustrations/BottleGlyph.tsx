const accentMap = {
  olive: { fill: "var(--color-olive-500)", label: "var(--color-olive-800)" },
  gold: { fill: "var(--color-gold-500)", label: "var(--color-gold-600)" },
  clay: { fill: "var(--color-clay-500)", label: "var(--color-clay-600)" },
  forest: { fill: "var(--color-forest-700)", label: "var(--color-forest-900)" },
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
  return (
    <svg
      viewBox="0 0 160 320"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M64 8H96V38C96 42 98 45 101 48C112 58 120 74 120 92V284C120 298 109 309 95 309H65C51 309 40 298 40 284V92C40 74 48 58 59 48C62 45 64 42 64 38V8Z"
        fill="var(--color-paper)"
        stroke={colors.fill}
        strokeWidth="2.5"
      />
      <rect x="40" y="130" width="80" height="120" fill={colors.fill} opacity="0.14" />
      <rect x="48" y="150" width="64" height="72" rx="2" fill="var(--color-paper)" stroke={colors.label} strokeWidth="1.5" />
      <line x1="56" y1="170" x2="104" y2="170" stroke={colors.label} strokeWidth="1.2" />
      <line x1="56" y1="180" x2="96" y2="180" stroke={colors.label} strokeWidth="1" opacity="0.6" />
      <line x1="56" y1="208" x2="88" y2="208" stroke={colors.label} strokeWidth="1" opacity="0.6" />
      <rect x="60" y="0" width="40" height="12" rx="2" fill={colors.fill} />
    </svg>
  );
}
