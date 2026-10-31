import { Check } from "lucide-react";
import { featureOptions } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Caratteristiche come pulsanti da toccare: stessa lista per immobili e richieste */
export function FeaturePicker({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
  const toggle = (f: string) => onChange(value.includes(f) ? value.filter((x) => x !== f) : [...value, f]);
  return (
    <fieldset>
      <legend className="mb-2 text-[15px] font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {featureOptions.map((f) => {
          const on = value.includes(f);
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(f)}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[15px] first-letter:uppercase",
                on ? "border-primary bg-primary-soft font-semibold text-primary-strong" : "bg-card text-foreground/80",
              )}
            >
              {on && <Check className="size-4" aria-hidden />}
              <span className="first-letter:uppercase">{f}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FeatureChips({ features, className }: { features: string[]; className?: string }) {
  if (!features.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {features.map((f) => (
        <li key={f} className="rounded-full bg-muted px-3 py-1 text-[15px] first-letter:uppercase">
          {f}
        </li>
      ))}
    </ul>
  );
}
