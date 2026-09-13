export function OliveBranch({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 120"
      fill="none"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 100C48 70 96 66 140 50C170 39 196 24 232 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {[
        [28, 88, -18],
        [56, 76, -12],
        [84, 66, -20],
        [112, 56, -10],
        [140, 46, -22],
        [166, 34, -14],
        [192, 22, -20],
      ].map(([x, y, r], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx="13"
          ry="6"
          transform={`rotate(${r} ${x} ${y})`}
          stroke="currentColor"
          strokeWidth="1.3"
        />
      ))}
      <circle cx="46" cy="94" r="5" fill="currentColor" />
      <circle cx="100" cy="72" r="5" fill="currentColor" />
      <circle cx="154" cy="50" r="5" fill="currentColor" />
      <circle cx="208" cy="28" r="5" fill="currentColor" />
    </svg>
  );
}
