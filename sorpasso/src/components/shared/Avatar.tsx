import { cn } from "@/lib/utils";
import { iniziali } from "@/lib/format";

const palette = [
  "bg-blue-100 text-blue-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
];

export function Avatar({ nome, size = "md", className }: { nome: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const hash = [...nome].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        palette[hash % palette.length],
        size === "xs" && "size-7 text-xs",
        size === "sm" && "size-9 text-sm",
        size === "md" && "size-12 text-base",
        size === "lg" && "size-16 text-xl",
        className,
      )}
    >
      {iniziali(nome) || "?"}
    </span>
  );
}
