import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Scelta a "card" basata su radio/checkbox nativi (accessibili da tastiera e lettori di schermo).
 * Uso: <ChoiceGroup legend="..."><Choice type="radio" name="x" value="a" label="A" /></ChoiceGroup>
 */
export function ChoiceGroup({
  legend,
  hint,
  error,
  className,
  children,
  id,
}: {
  legend: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <fieldset
      className="grid gap-2.5"
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-2.5 text-sm font-medium">{legend}</legend>
      <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-[0.8125rem] font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function Choice({
  label,
  description,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  type: "radio" | "checkbox";
  label: string;
  description?: string;
}) {
  return (
    <label
      className={cn(
        "relative flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border border-input bg-card px-3.5 py-2 text-sm transition-colors select-none",
        "hover:border-nx-blue-500/50 has-[:checked]:border-nx-blue-500 has-[:checked]:bg-accent has-[:checked]:text-accent-foreground",
        "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
        className,
      )}
    >
      <input {...props} className="sr-only" />
      <span className="font-medium">{label}</span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </label>
  );
}
