import { cn } from "@/lib/utils";

/** Interruttore acceso/spento, sempre con la scritta sotto */
export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${on ? "Spegni" : "Accendi"}: ${label}`}
      onClick={onChange}
      disabled={disabled}
      className="flex min-h-12 shrink-0 flex-col items-center justify-center gap-1 disabled:opacity-50"
    >
      <span className={cn("flex h-8 w-14 items-center rounded-full p-1 transition-colors", on ? "bg-success" : "bg-border")}>
        <span className={cn("size-6 rounded-full bg-white shadow transition-transform", on && "translate-x-6")} />
      </span>
      <span className={cn("text-[13px] font-semibold", on ? "text-success" : "text-muted-foreground")}>{on ? "Accesa" : "Spenta"}</span>
    </button>
  );
}
