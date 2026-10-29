export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#0b1630" stroke="#2f6bff" strokeOpacity=".45" />
        <path d="M8 21l7-10h4l-4 6h7l-7 10h-4l4-6z" fill="#3d7bff" />
      </svg>
      <span className="font-display text-[19px] font-extrabold tracking-tight text-white">
        Sorpasso<span className="text-accent-2"> AI</span>
      </span>
    </span>
  );
}
