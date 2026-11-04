import { Stat } from "@/components/ui/stat";

export type AdminNumbers = {
  venditeMeseCents: number | null;
  studentiAttivi: number | null;
  completamentoMedio: number | null;
  lezioneAbbandoni: string | null;
};

const mese = () => new Intl.DateTimeFormat("it-IT", { month: "long" }).format(new Date());

/** Riga dei quattro numeri (mockup Admin). null = dato non ancora disponibile. */
export function AdminStats({ n }: { n: AdminNumbers }) {
  const euro = (c: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(c / 100);
  return (
    <section aria-label="Numeri principali" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Stat
        label={`Vendite · ${mese()}`}
        value={n.venditeMeseCents === null ? "—" : euro(n.venditeMeseCents)}
      />
      <Stat label="Studenti attivi" value={n.studentiAttivi ?? "—"} />
      <Stat
        label="Completamento medio"
        value={n.completamentoMedio === null ? "—" : `${n.completamentoMedio}%`}
      />
      <div className="rounded-lg border border-line bg-surface p-6">
        <p className="text-sm font-medium text-ink-muted">Dove si fermano</p>
        <p className="mt-3 text-[15px] leading-snug font-semibold">
          {n.lezioneAbbandoni ?? "Lezione con più abbandoni del mese"}
        </p>
        {!n.lezioneAbbandoni && (
          <p className="mt-1 text-xs text-ink-muted">Dati in arrivo dalla Fase 4</p>
        )}
      </div>
    </section>
  );
}
