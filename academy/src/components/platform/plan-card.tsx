import Link from "next/link";
import { Check } from "lucide-react";
import { planFeatures, type Plan } from "@/lib/data/plans";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";

export function PlanCard({ plan, highlight = false }: { plan: Plan; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-surface p-7",
        highlight ? "border-nexora-blue ring-1 ring-nexora-blue" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xl font-bold">{plan.nome}</h3>
        {highlight && <Badge tone="solid">Il più scelto</Badge>}
      </div>
      {plan.descrizione && <p className="mt-2 text-sm text-ink-muted">{plan.descrizione}</p>}
      <p className="mt-6 flex items-baseline gap-2">
        <Price cents={plan.prezzo_mese_cents} className="text-4xl" />
        <span className="text-sm text-ink-muted">/ mese</span>
      </p>
      {plan.prezzo_anno_cents && (
        <p className="mt-1 text-[13px] text-ink-muted">
          Oppure {(plan.prezzo_anno_cents / 100).toLocaleString("it-IT")} € l&apos;anno: due mesi
          gratis.
        </p>
      )}
      <Button
        asChild
        size="lg"
        block
        className="mt-6"
        variant={highlight ? "primary" : "secondary"}
      >
        <Link href={`/crea-academy?piano=${plan.codice}`}>Prova gratis 14 giorni</Link>
      </Button>
      <ul className="mt-6 flex flex-col gap-3 text-sm">
        {planFeatures(plan).map((f) => (
          <li key={f} className="flex gap-3">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-positive" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
