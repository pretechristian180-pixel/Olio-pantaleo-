import * as React from "react";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/labels";

interface BadgeProps extends React.ComponentProps<"span"> {
  tone?: Tone;
  dot?: boolean;
  size?: "sm" | "md";
}

function Badge({ tone = "gray", dot = true, size = "md", className, children, ...props }: BadgeProps) {
  const t = toneClasses[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium leading-none",
        size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs",
        t.soft,
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("size-2 rounded-full", t.dot)} aria-hidden />}
      {children}
    </span>
  );
}

export { Badge };
