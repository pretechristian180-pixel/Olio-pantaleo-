import { cn } from "@/lib/utils";

type ProgressBarProps = {
  value: number;
  label?: string;
  showValue?: boolean;
  tone?: "light" | "dark";
  size?: "sm" | "md";
  className?: string;
};

export function ProgressBar({
  value,
  label = "Avanzamento",
  showValue = false,
  tone = "light",
  size = "sm",
  className,
}: ProgressBarProps) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        className={cn(
          "w-full overflow-hidden rounded-full",
          size === "sm" ? "h-1.5" : "h-2.5",
          tone === "dark" ? "bg-white/15" : "bg-line",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full",
            tone === "dark" ? "bg-nexora-blue-bright" : "bg-nexora-blue",
          )}
          style={{ width: `${v}%` }}
        />
      </div>
      {showValue && (
        <span
          className={cn(
            "min-w-[3ch] text-right text-sm font-semibold tabular-nums",
            tone === "dark" ? "text-white" : "text-ink",
          )}
        >
          {v}%
        </span>
      )}
    </div>
  );
}
