import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] leading-none font-semibold tracking-[0.12em] uppercase",
  {
    variants: {
      tone: {
        blue: "bg-blue-tint text-nexora-blue-deep",
        solid: "bg-nexora-blue text-white",
        neutral: "bg-surface-alt text-ink-muted",
        positive: "bg-positive-tint text-positive-deep",
        negative: "bg-negative/10 text-negative",
        dark: "bg-white/10 text-white",
      },
    },
    defaultVariants: { tone: "blue" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
