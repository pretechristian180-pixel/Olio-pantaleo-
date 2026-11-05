import { Check } from "lucide-react";

import { ONBOARDING_STEP_LABELS } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

/** Indicatore di avanzamento dell'onboarding. */
export function Steps({ current }: { current: number }) {
  const total = ONBOARDING_STEP_LABELS.length;
  return (
    <nav aria-label="Avanzamento">
      <p className="mb-3 text-sm font-medium text-muted-foreground">
        Passo {current} di {total} ·{" "}
        <span className="text-foreground">{ONBOARDING_STEP_LABELS[current - 1]}</span>
      </p>
      <ol className="grid grid-cols-4 gap-1.5">
        {ONBOARDING_STEP_LABELS.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} aria-current={n === current ? "step" : undefined}>
              <span className="sr-only">
                {label}: {n < current ? "completato" : n === current ? "in corso" : "da fare"}
              </span>
              <span
                aria-hidden
                className={cn(
                  "block h-1.5 rounded-full bg-muted",
                  n < current && "bg-nx-blue-500",
                  n === current && "bg-brand-gradient",
                )}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-2">
      <h1 className="text-2xl font-semibold text-balance sm:text-3xl">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

export function DoneMark() {
  return (
    <span className="flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow">
      <Check className="size-7" aria-hidden />
    </span>
  );
}
