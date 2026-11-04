import * as React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.ComponentProps<"div"> & { tone?: "default" | "tint" | "dark" };

export function Card({ className, tone = "default", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg",
        tone === "default" && "border border-line bg-surface",
        tone === "tint" && "bg-blue-tint",
        tone === "dark" && "bg-graphite-deep text-white",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-lg leading-snug font-semibold", className)} {...props} />;
}
