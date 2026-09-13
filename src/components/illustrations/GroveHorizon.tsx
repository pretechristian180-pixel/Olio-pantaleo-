export function GroveHorizon({ className = "" }: { className?: string }) {
  const trees = Array.from({ length: 14 });
  return (
    <svg
      viewBox="0 0 1400 160"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="120" width="1400" height="40" fill="currentColor" opacity="0.9" />
      {trees.map((_, i) => {
        const x = i * 104 + (i % 2 === 0 ? 0 : 40);
        const scale = i % 3 === 0 ? 1.15 : 0.9;
        return (
          <g key={i} transform={`translate(${x} 60) scale(${scale})`} opacity="0.9">
            <rect x="26" y="40" width="6" height="40" fill="currentColor" />
            <ellipse cx="29" cy="26" rx="34" ry="24" fill="currentColor" />
            <ellipse cx="8" cy="38" rx="22" ry="16" fill="currentColor" />
            <ellipse cx="52" cy="38" rx="22" ry="16" fill="currentColor" />
          </g>
        );
      })}
    </svg>
  );
}
