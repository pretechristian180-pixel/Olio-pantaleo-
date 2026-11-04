import * as React from "react";
import { cn } from "@/lib/utils";

/** Sopratitolo maiuscolo spaziato, es. "MODULO 3 · LEZIONE 4". */
export function Eyebrow({
  className,
  tone = "blue",
  as: Tag = "p",
  ...props
}: React.ComponentProps<"p"> & { tone?: "blue" | "muted" | "bright"; as?: "p" | "span" | "div" }) {
  return (
    <Tag
      className={cn(
        "eyebrow",
        tone === "blue" && "text-nexora-blue",
        tone === "muted" && "text-ink-muted",
        tone === "bright" && "text-nexora-blue-bright",
        className,
      )}
      {...props}
    />
  );
}
