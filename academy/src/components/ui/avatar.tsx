import { cn } from "@/lib/utils";

export function initials(nome?: string | null, cognome?: string | null) {
  const a = (nome ?? "").trim()[0] ?? "";
  const b = (cognome ?? "").trim()[0] ?? "";
  return (a + b).toUpperCase() || "N";
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-nexora-blue text-sm font-semibold text-white",
        className,
      )}
    >
      {name}
    </span>
  );
}
