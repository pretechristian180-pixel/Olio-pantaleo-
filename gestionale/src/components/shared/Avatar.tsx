import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const palette = ["bg-blue-100 text-blue-800", "bg-emerald-100 text-emerald-800", "bg-amber-100 text-amber-800", "bg-violet-100 text-violet-800", "bg-rose-100 text-rose-800", "bg-teal-100 text-teal-800"];

export function Avatar({
  person,
  size = "md",
  className,
}: {
  person: { firstName: string; lastName: string };
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hash = [...(person.firstName + person.lastName)].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        palette[hash % palette.length],
        size === "sm" && "size-9 text-sm",
        size === "md" && "size-12 text-base",
        size === "lg" && "size-16 text-xl",
        className,
      )}
    >
      {initials(person)}
    </span>
  );
}
