import { cn } from "@/lib/utils";

export function Logo({ className, invert }: { className?: string; invert?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill={invert ? "#ffffff" : "#0b1630"} />
        <path d="M8 21l7-10h4l-4 6h7l-7 10h-4l4-6z" fill="#3d7bff" />
      </svg>
      <span className={cn("text-[19px] font-bold tracking-tight", invert ? "text-white" : "text-primary")}>
        Sorpasso<span className="text-accent"> AI</span>
      </span>
    </span>
  );
}
