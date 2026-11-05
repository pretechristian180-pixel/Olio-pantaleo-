import { Stat } from "@/components/ui/stat";
import type { Overview } from "@/lib/data/admin-panel";

const mese = () => new Intl.DateTimeFormat("it-IT", { month: "long" }).format(new Date());
const euro = (c: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(c / 100);

/** Riga dei quattro numeri principali (mockup Admin). */
export function AdminStats({ n }: { n: Overview }) {
  return (
    <section aria-label="Numeri principali" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Stat
        label={`Vendite · ${mese()}`}
        value={euro(n.vendite_mese_cents)}
        hint={`${n.ordini_mese} ${n.ordini_mese === 1 ? "ordine" : "ordini"} · totale ${euro(n.vendite_totali_cents)}`}
      />
      <Stat
        label="Studenti attivi"
        value={n.studenti_attivi}
        hint={`negli ultimi 30 giorni, su ${n.studenti_totali} iscritti`}
      />
      <Stat
        label="Completamento medio"
        value={n.completamento_medio === null ? "—" : `${n.completamento_medio}%`}
        hint="delle lezioni nei corsi acquistati"
      />
      <div className="rounded-lg border border-line bg-surface p-6">
        <p className="text-sm font-medium text-ink-muted">Dove si fermano</p>
        <p className="mt-3 text-[15px] leading-snug font-semibold">
          {n.lezione_abbandoni ?? "Nessun abbandono da segnalare"}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {n.lezione_abbandoni
            ? `${n.lezione_abbandoni_corso} · lezione dove più studenti sono fermi da oltre 7 giorni`
            : "Qui compare la lezione dove più studenti si fermano"}
        </p>
      </div>
    </section>
  );
}
