import { cn } from "@/lib/utils";

/**
 * Prezzo con le cifre in Michroma e il simbolo di valuta in Montserrat
 * (Michroma non ha il glifo €).
 */
export function Price({
  cents,
  currency = "EUR",
  className,
}: {
  cents: number;
  currency?: string;
  className?: string;
}) {
  const parts = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).formatToParts(cents / 100);
  const symbol = parts.find((p) => p.type === "currency")?.value ?? currency;
  const number = parts
    .filter((p) => p.type !== "currency" && p.type !== "literal")
    .map((p) => p.value)
    .join("");
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="font-display">{number}</span>
      <span className="font-sans font-semibold">{symbol}</span>
    </span>
  );
}
