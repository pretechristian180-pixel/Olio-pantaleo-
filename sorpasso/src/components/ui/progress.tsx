import { cn } from "@/lib/utils";

function Progress({ value, className, tone = "bg-accent" }: { value: number; className?: string; tone?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-300", tone)} style={{ width: `${value}%` }} />
    </div>
  );
}

export { Progress };
