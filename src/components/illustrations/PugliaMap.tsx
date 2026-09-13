export function PugliaMap({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 420"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Stylised silhouette of Puglia: Gargano promontory (spur), the heel body, Salento peninsula */}
      <path
        d="M150 8
           C 172 10, 196 20, 214 36
           C 232 52, 222 70, 200 66
           C 182 63, 168 56, 160 66
           C 176 78, 200 92, 206 112
           C 210 128, 196 132, 182 124
           C 168 116, 160 104, 150 100
           C 158 118, 176 138, 182 160
           C 188 182, 176 198, 168 216
           C 160 234, 168 250, 182 262
           C 200 276, 214 296, 210 318
           C 206 340, 188 356, 178 374
           C 172 386, 176 398, 168 408
           C 160 400, 156 386, 148 378
           C 138 368, 140 352, 130 340
           C 118 326, 108 314, 110 296
           C 112 280, 124 268, 118 252
           C 112 236, 96 228, 92 210
           C 88 192, 100 178, 96 160
           C 92 142, 76 132, 74 114
           C 72 98, 84 84, 100 78
           C 90 66, 84 50, 96 38
           C 108 26, 126 22, 138 14
           C 142 10, 146 8, 150 8 Z"
        fill="var(--color-olive-100)"
        stroke="var(--color-olive-700)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Fasano marker */}
      <g transform="translate(150 150)">
        <circle r="6" fill="var(--color-clay-500)" />
        <circle r="12" fill="none" stroke="var(--color-clay-500)" strokeWidth="1.5" opacity="0.6" />
      </g>
      <text
        x="168"
        y="155"
        fontSize="15"
        fill="var(--color-ink)"
        fontFamily="var(--font-sans)"
      >
        Fasano
      </text>
    </svg>
  );
}
