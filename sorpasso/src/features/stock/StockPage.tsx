import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Car, Euro, Plus, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, ListSkeleton } from "@/components/shared/States";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useSessione } from "@/lib/auth";
import { euro } from "@/lib/format";
import { ALIMENTAZIONI, STATI_VEICOLO, TIPI_VEICOLO, opzioni } from "@/lib/labels";
import { useFotoUrls } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { Alimentazione, StatoVeicolo, TipoVeicolo, VehicleView } from "@/types/db";
import { useVeicoli } from "./api";
import { VeicoloCard } from "./VeicoloCard";

type FiltroStato = "non_venduti" | "tutti" | StatoVeicolo;
type Ordine = "giacenza" | "prezzo_asc" | "prezzo_desc" | "recenti";

const FASCE = [
  { value: "", label: "Qualsiasi prezzo" },
  { value: "0-10000", label: "Fino a 10.000 €" },
  { value: "10000-20000", label: "10.000 – 20.000 €" },
  { value: "20000-30000", label: "20.000 – 30.000 €" },
  { value: "30000-50000", label: "30.000 – 50.000 €" },
  { value: "50000-", label: "Oltre 50.000 €" },
];

export default function StockPage() {
  const { isManager } = useSessione();
  const veicoli = useVeicoli();

  const [cerca, setCerca] = useState("");
  const [tipo, setTipo] = useState<TipoVeicolo | "">("");
  const [stato, setStato] = useState<FiltroStato>("non_venduti");
  const [alimentazione, setAlimentazione] = useState<Alimentazione | "">("");
  const [fascia, setFascia] = useState("");
  const [soloOltreSoglia, setSoloOltreSoglia] = useState(false);
  const [pubblicazione, setPubblicazione] = useState<"" | "online" | "non_pubblicate" | "errori">("");
  const [ordine, setOrdine] = useState<Ordine>("giacenza");
  const [filtriAperti, setFiltriAperti] = useState(false);

  const tutti = veicoli.data ?? [];

  const filtrati = useMemo(() => {
    const t = cerca.trim().toLowerCase();
    const [min, max] = fascia ? fascia.split("-").map((x) => (x ? Number(x) : undefined)) : [];
    const lista = tutti.filter((v) => {
      if (t && !`${v.marca} ${v.modello} ${v.versione ?? ""} ${v.targa ?? ""}`.toLowerCase().includes(t)) return false;
      if (tipo && v.tipo !== tipo) return false;
      if (stato === "non_venduti" ? v.stato === "venduto" : stato !== "tutti" && v.stato !== stato) return false;
      if (alimentazione && v.alimentazione !== alimentazione) return false;
      if (min !== undefined && (v.prezzo_vendita ?? 0) < min) return false;
      if (max !== undefined && (v.prezzo_vendita ?? 0) >= max) return false;
      if (soloOltreSoglia && !v.oltre_soglia) return false;
      if (pubblicazione === "online" && !v.portali_online.length) return false;
      if (pubblicazione === "non_pubblicate" && v.portali_online.length) return false;
      if (pubblicazione === "errori" && !v.pubblicazione_errore) return false;
      return true;
    });
    const cmp: Record<Ordine, (a: VehicleView, b: VehicleView) => number> = {
      giacenza: (a, b) => b.giorni_giacenza - a.giorni_giacenza,
      prezzo_asc: (a, b) => (a.prezzo_vendita ?? 0) - (b.prezzo_vendita ?? 0),
      prezzo_desc: (a, b) => (b.prezzo_vendita ?? 0) - (a.prezzo_vendita ?? 0),
      recenti: (a, b) => b.data_ingresso.localeCompare(a.data_ingresso) || b.created_at.localeCompare(a.created_at),
    };
    return [...lista].sort(cmp[ordine]);
  }, [tutti, cerca, tipo, stato, alimentazione, fascia, soloOltreSoglia, pubblicazione, ordine]);

  const inStock = tutti.filter((v) => v.stato !== "venduto");
  const disponibili = inStock.filter((v) => v.stato === "disponibile").length;
  const oltreSoglia = inStock.filter((v) => v.oltre_soglia).length;
  const valore = inStock.reduce((s, v) => s + (v.prezzo_vendita ?? 0), 0);

  const foto = useFotoUrls(filtrati.map((v) => v.foto_copertina));

  const filtriAttivi = [tipo, alimentazione, fascia, pubblicazione].filter(Boolean).length + (soloOltreSoglia ? 1 : 0) + (stato !== "non_venduti" ? 1 : 0);
  const azzera = () => {
    setCerca("");
    setTipo("");
    setStato("non_venduti");
    setAlimentazione("");
    setFascia("");
    setSoloOltreSoglia(false);
    setPubblicazione("");
  };

  const aggiungi = isManager ? (
    <Button asChild variant="accent">
      <Link to="/stock/nuovo">
        <Plus aria-hidden /> Aggiungi auto
      </Link>
    </Button>
  ) : undefined;

  return (
    <div>
      <PageHeader title="Stock" subtitle="Le auto in vendita e da quanto tempo sono in piazzale." action={aggiungi} />

      {veicoli.isLoading ? (
        <ListSkeleton rows={6} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:h-72" />
      ) : veicoli.isError ? (
        <ErrorState error={veicoli.error} onRetry={() => void veicoli.refetch()} />
      ) : tutti.length === 0 ? (
        <EmptyState
          art="auto"
          title="Nessuna auto in stock"
          text={isManager ? "Inserisci la prima auto: bastano marca, modello e prezzo, le foto le aggiungi dal telefono." : "Il titolare o il responsabile vendite non hanno ancora inserito auto."}
          action={aggiungi && (
            <Button asChild variant="accent" size="lg">
              <Link to="/stock/nuovo">
                <Plus aria-hidden /> Aggiungi la prima auto
              </Link>
            </Button>
          )}
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard value={disponibili} label="Auto disponibili" tone="green" icon={<Car />} />
            <button type="button" className="text-left" onClick={() => setSoloOltreSoglia(true)}>
              <StatCard
                value={oltreSoglia}
                label="Ferme oltre la soglia"
                hint={oltreSoglia ? "Tocca per vederle" : "Nessuna, ottimo"}
                tone={oltreSoglia ? "red" : "green"}
                icon={<AlertTriangle />}
              />
            </button>
            <StatCard value={euro(valore)} label="Valore dello stock" tone="blue" icon={<Euro />} />
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={cerca}
                onChange={(e) => setCerca(e.target.value)}
                placeholder="Cerca marca, modello o targa"
                className="pl-11"
                aria-label="Cerca nello stock"
              />
            </div>
            <div className="flex gap-3">
              <Select value={ordine} onChange={(e) => setOrdine(e.target.value as Ordine)} aria-label="Ordina" className="sm:w-56">
                <option value="giacenza">Più vecchie in stock</option>
                <option value="recenti">Ultime arrivate</option>
                <option value="prezzo_asc">Prezzo crescente</option>
                <option value="prezzo_desc">Prezzo decrescente</option>
              </Select>
              <Button variant="outline" onClick={() => setFiltriAperti((v) => !v)} aria-expanded={filtriAperti}>
                <SlidersHorizontal aria-hidden />
                Filtri{filtriAttivi > 0 && ` (${filtriAttivi})`}
              </Button>
            </div>
          </div>

          {filtriAperti && (
            <div className="mb-5 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
              <Select value={stato} onChange={(e) => setStato(e.target.value as FiltroStato)} aria-label="Stato">
                <option value="non_venduti">In stock (non vendute)</option>
                <option value="tutti">Tutte, anche vendute</option>
                {opzioni(STATI_VEICOLO).map((o) => (
                  <option key={o.value} value={o.value}>
                    Solo {o.label.toLowerCase()}
                  </option>
                ))}
              </Select>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoVeicolo | "")} aria-label="Tipo">
                <option value="">Nuovo, usato e km 0</option>
                {opzioni(TIPI_VEICOLO).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Select value={alimentazione} onChange={(e) => setAlimentazione(e.target.value as Alimentazione | "")} aria-label="Alimentazione">
                <option value="">Tutte le alimentazioni</option>
                {opzioni(ALIMENTAZIONI).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Select value={fascia} onChange={(e) => setFascia(e.target.value)} aria-label="Fascia di prezzo">
                {FASCE.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
              <Select value={pubblicazione} onChange={(e) => setPubblicazione(e.target.value as typeof pubblicazione)} aria-label="Pubblicazione sui portali">
                <option value="">Pubblicazione: tutte</option>
                <option value="online">Online su almeno un portale</option>
                <option value="non_pubblicate">Non pubblicate</option>
                <option value="errori">Con errori di pubblicazione</option>
              </Select>
              <label className="flex h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 text-[15px]">
                <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={soloOltreSoglia} onChange={(e) => setSoloOltreSoglia(e.target.checked)} />
                Solo oltre soglia
              </label>
            </div>
          )}

          {(soloOltreSoglia || filtriAttivi > 0 || cerca) && (
            <div className="mb-4 flex items-center justify-between gap-3 text-[15px] text-muted-foreground">
              <span>
                {filtrati.length} {filtrati.length === 1 ? "auto trovata" : "auto trovate"}
              </span>
              <button type="button" onClick={azzera} className={cn("h-10 font-medium text-accent")}>
                Azzera filtri
              </button>
            </div>
          )}

          {filtrati.length === 0 ? (
            <EmptyState
              art="ricerca"
              compact
              title="Nessuna auto con questi filtri"
              action={
                <Button variant="outline" onClick={azzera}>
                  Azzera filtri
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtrati.map((v) => (
                <VeicoloCard key={v.id} v={v} fotoUrl={v.foto_copertina ? foto.data?.[v.foto_copertina] ?? undefined : undefined} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
