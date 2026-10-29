import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CATALOGO_OPTIONAL } from "@/lib/optional";
import { cn } from "@/lib/utils";

/**
 * Optional ed equipaggiamenti a checkbox, raggruppati per categoria, con ricerca.
 * Le voci salvate che non sono nel catalogo (es. arrivate da vecchi dati) restano visibili in "Altri".
 */
export function OptionalPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [cerca, setCerca] = useState("");
  const [aperti, setAperti] = useState<Record<string, boolean>>({});
  const selezionati = useMemo(() => new Set(value), [value]);

  const gruppi = useMemo(() => {
    const noti = new Set(CATALOGO_OPTIONAL.flatMap((g) => g.voci));
    const altri = value.filter((v) => !noti.has(v));
    const tutti = altri.length ? [...CATALOGO_OPTIONAL, { categoria: "Altri", voci: altri }] : CATALOGO_OPTIONAL;
    const t = cerca.trim().toLowerCase();
    return tutti
      .map((g) => ({ ...g, visibili: t ? g.voci.filter((v) => v.toLowerCase().includes(t)) : g.voci }))
      .filter((g) => g.visibili.length > 0);
  }, [value, cerca]);

  const toggle = (voce: string) => onChange(selezionati.has(voce) ? value.filter((v) => v !== voce) : [...value, voce]);
  const tuttiGruppo = (voci: string[], on: boolean) =>
    onChange(on ? [...new Set([...value, ...voci])] : value.filter((v) => !voci.includes(v)));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca un optional…" className="pl-11" aria-label="Cerca optional" />
        </div>
        <p className="text-[15px] text-muted-foreground">
          <strong className="text-foreground tabular-nums">{value.length}</strong> selezionati
        </p>
      </div>

      {gruppi.length === 0 && <p className="text-muted-foreground">Nessun optional trovato: aggiungilo nel campo libero qui sotto.</p>}

      <div className="divide-y rounded-lg border">
        {gruppi.map((g) => {
          const scelti = g.voci.filter((v) => selezionati.has(v)).length;
          const aperto = !!cerca.trim() || (aperti[g.categoria] ?? scelti > 0);
          return (
            <div key={g.categoria}>
              <button
                type="button"
                onClick={() => setAperti((a) => ({ ...a, [g.categoria]: !aperto }))}
                className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left font-medium hover:bg-muted/60"
                aria-expanded={aperto}
              >
                <span className="flex-1">{g.categoria}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-sm tabular-nums", scelti ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground")}>
                  {scelti}/{g.voci.length}
                </span>
                <ChevronDown className={cn("size-5 text-muted-foreground transition-transform", aperto && "rotate-180")} aria-hidden />
              </button>
              {aperto && (
                <div className="px-4 pb-4">
                  <div className="mb-2 flex gap-3 text-sm">
                    <button type="button" className="font-medium text-accent" onClick={() => tuttiGruppo(g.voci, true)}>
                      Seleziona tutti
                    </button>
                    <button type="button" className="font-medium text-muted-foreground" onClick={() => tuttiGruppo(g.voci, false)}>
                      Deseleziona
                    </button>
                  </div>
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    {g.visibili.map((voce) => (
                      <label key={voce} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
                        <input type="checkbox" className="size-5 shrink-0 accent-[var(--accent)]" checked={selezionati.has(voce)} onChange={() => toggle(voce)} />
                        {voce}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
