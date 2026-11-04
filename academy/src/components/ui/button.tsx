import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-nexora-blue text-white hover:bg-nexora-blue-deep",
        secondary: "border border-line bg-surface text-ink hover:border-ink-muted",
        ghost: "text-ink hover:bg-surface-alt",
        dark: "bg-graphite-deep text-white hover:bg-graphite",
        inverse: "bg-white text-ink hover:bg-blue-tint",
        "outline-inverse": "border border-white/30 text-white hover:bg-white/10",
        danger: "bg-negative text-white hover:bg-negative/90",
      },
      size: {
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-base",
        icon: "size-11",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Rende il figlio (es. <Link>) con lo stile del pulsante. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, block, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
