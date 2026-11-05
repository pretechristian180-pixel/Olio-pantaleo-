"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const options = [
  { value: "dark", label: "Scuro", icon: Moon },
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

const subscribe = () => () => {};

/** Selettore del tema a tre opzioni, accessibile da tastiera (radiogroup). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // Evita il mismatch di idratazione: il tema è noto solo nel browser.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Tema dell'interfaccia"
      className={cn("inline-flex rounded-lg border bg-muted/50 p-1", className)}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors",
              active && "bg-card text-foreground shadow-sm",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
