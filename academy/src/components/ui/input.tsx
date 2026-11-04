import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-13 w-full rounded-md border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-ink-muted focus:border-nexora-blue focus:outline-none disabled:opacity-60 aria-invalid:border-negative",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-31 w-full rounded-md border border-line bg-surface px-4 py-3 text-[15px] leading-6 text-ink placeholder:text-ink-muted focus:border-nexora-blue focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("mb-2 block text-sm font-semibold", className)} {...props} />;
}

/** Campo con etichetta ed errore collegati per gli screen reader. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (a11y: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}) {
  const describedBy = error ? `${id}-errore` : hint ? `${id}-aiuto` : undefined;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-errore`} className="mt-1.5 text-[13px] text-negative">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-aiuto`} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 text-sm", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 rounded-sm border-line accent-nexora-blue"
        {...props}
      />
      <span className="pt-px">{label}</span>
    </label>
  );
}
