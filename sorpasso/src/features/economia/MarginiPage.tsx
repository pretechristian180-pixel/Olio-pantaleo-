import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, ArrowUpDown, Car, Clock, Coins, Download, Info, Percent, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Section } from "@/components/shared/Section";
import { StatCard } from "@/components/shared/StatCard";
import { ErrorState, Spinner } from "@/components/shared/States";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { mostraErrore } from "@/lib/errors";
import { addDays, dataBreve, euro, startOfDay, startOfMonth, toDateInput } from "@/lib/format";
import { REGIMI_IVA, STATI_VEICOLO, TIPI_VEICOLO, opzioni } from "@/lib/labels";
import { useColleghi } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { TipoVeicolo, VehicleEconomics } from "@/types/db";
import { leggiCostiPerEsportazione, useEconomiaElenco } from "./api";
import { creaCsv, dataCsv, scaricaCsv } from "./csv";
import { NOTA_COMMERCIALISTA } from "./ContoEconomicoTab";
import { Semaforo } from "./Semaforo";

/*
 * Colori del grafico (validati con lo script dataviz: CVD e contrasto ok su bianco).
 * Margine positivo = blu elettrico, negativo = arancio; il segno è anche nella posizione rispetto allo zero.
 */
const C = { positivo: "#3d6bff", negativo: "#eb6834", griglia: "#e5e9f0", asse: "#5b6578", zero: "#5b6578" };

type Periodo = "mese" | "mese_scorso" | "3_mesi" | "anno" | "personalizzato";
const PERIODI: { value: Periodo; label: string }[] = [
  { value: "mese", label: "Questo mese" },
  { value: "mese_scorso", label: "Mese scorso" },
  { value: "3_mesi", label: "Ultimi 3 mesi" },
  { value: "anno", label: "Quest'anno" },
  { value: "personalizzato", label: "Personalizzato" },
];
type FiltroStato = "vendute" | "stock" | "tutte";

function intervallo(p: Periodo, da: string, a: string): { da: Date; a: Date } {
  const oggi = new Date();
  const domani = addDays(startOfDay(oggi), 1);
  switch (p) {
    case "mese":
      return { da: startOfMonth(oggi), a: domani };
    case "mese_scorso":
      return { da: new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1), a: startOfMonth(oggi) };
    case "3_mesi":
      return { da: new Date(oggi.getFullYear(), oggi.getMonth() - 2, 1), a: domani };
    case "anno":
      return { da: new Date(oggi.getFullYear(), 0, 1), a: domani };
    case "personalizzato":
      return { da: startOfDay(new Date(da)), a: addDays(startOfDay(new Date(a)), 1) };
  }
}

const ricaviNetti = (r: VehicleEconomics) => (r.ricavo_vendita_netto ?? 0) + r.altri_ricavi_netti;
const nomeAuto = (r: VehicleEconomics) => `${r.marca} ${r.modello}${r.versione ? ` ${r.versione}` : ""}`;
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`);
const NOMI_MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
/** Data locale YYYY-MM-DD (le date del DB sono giorni, non istanti). */
const giornoIso = (d: Date) => toDateInput(d);

type Colonna = "auto" | "data" | "giorni" | "costi" | "ricavi" | "margine" | "pct" | "dopo";

export default function MarginiPage() {
  const elenco = useEconomiaElenco();
  const colleghi = useColleghi();

  const [periodo, setPeriodo] = useState<Periodo>("mese");
  const [daCustom, setDaCustom] = useState(toDateInput(addDays(new Date(), -30)));
  const [aCustom, setACustom] = useState(toDateInput(new Date()));
  const [stato, setStato] = useState<FiltroStato>("vendute");
  const [tipo, setTipo] = useState<TipoVeicolo | "">("");
  const [marca, setMarca] = useState("");
  const [venditore, setVenditore] = useState("");
  const [ordine, setOrdine] = useState<{ col: Colonna; desc: boolean }>({ col: "data", desc: true });
  const [esportando, setEsportando] = useState(false);

  const range = useMemo(() => intervallo(periodo, daCustom, aCustom), [periodo, daCustom, aCustom]);
  const rangeValido = range.da < range.a && !Number.isNaN(range.da.getTime()) && !Number.isNaN(range.a.getTime());
  const etichettaPeriodo =
    periodo === "personalizzato" ? `dal ${dataBreve(range.da)} al ${dataBreve(addDays(range.a, -1))}` : PERIODI.find((p) => p.value === periodo)!.label.toLowerCase();

  const righe = elenco.data ?? [];
  const marche = useMemo(() => [...new Set(righe.map((r) => r.marca))].sort((a, b) => a.localeCompare(b, "it")), [righe]);
  const venditori = useMemo(() => {
    const ids = new Set(righe.map((r) => r.venditore_id).filter(Boolean));
    return (colleghi.data ?? []).filter((p) => ids.has(p.user_id));
  }, [righe, colleghi.data]);

  // Filtri che valgono per tutto (tipo, marca, venditore)
  const base = useMemo(
    () =>
      righe.filter(
        (r) => (!tipo || r.tipo === tipo) && (!marca || r.marca === marca) && (!venditore || r.venditore_id === venditore),
      ),
    [righe, tipo, marca, venditore],
  );

  const daIso = giornoIso(range.da);
  const aIso = giornoIso(range.a);
  const vendutaNelPeriodo = (r: VehicleEconomics) => r.venduta && !!r.data_vendita && r.data_vendita >= daIso && r.data_vendita < aIso;

  const filtrate = useMemo(() => {
    if (!rangeValido && stato !== "stock") return [];
    return base.filter((r) =>
      stato === "vendute" ? vendutaNelPeriodo(r) : stato === "stock" ? !r.venduta : vendutaNelPeriodo(r) || !r.venduta,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, stato, daIso, aIso, rangeValido]);

  const vendute = filtrate.filter((r) => r.venduta);
  const inStock = filtrate.filter((r) => !r.venduta);

  const kpi = useMemo(() => {
    const somma = (f: (r: VehicleEconomics) => number) => vendute.reduce((a, r) => a + f(r), 0);
    const ricavi = somma(ricaviNetti);
    const costi = somma((r) => r.costi_effettivi);
    const margine = somma((r) => r.margine ?? 0);
    const dopo = somma((r) => r.margine_dopo_giacenza ?? 0);
    const n = vendute.length;
    return {
      n,
      ricavi,
      costi,
      margine,
      dopo,
      medio: n ? margine / n : null,
      medioPct: ricavi > 0 ? (margine * 100) / ricavi : null,
      giorni: n ? somma((r) => r.giorni_stock) / n : null,
      stockMargine: inStock.reduce((a, r) => a + (r.margine ?? 0), 0),
      stockCosti: inStock.reduce((a, r) => a + r.costi_effettivi, 0),
    };
  }, [vendute, inStock]);

  // Grafico: margine medio per mese, ultimi 12 mesi (solo vendute, con i filtri tipo/marca/venditore)
  const perMese = useMemo(() => {
    const oggi = new Date();
    const mesi = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(oggi.getFullYear(), oggi.getMonth() - 11 + i, 1);
      return { chiave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, etichetta: `${NOMI_MESI[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, somma: 0, n: 0 };
    });
    for (const r of base) {
      if (!r.venduta || !r.data_vendita || r.margine == null) continue;
      const m = mesi.find((x) => x.chiave === r.data_vendita!.slice(0, 7));
      if (m) {
        m.somma += r.margine;
        m.n += 1;
      }
    }
    return mesi.map((m) => ({ ...m, medio: m.n ? Math.round(m.somma / m.n) : null }));
  }, [base]);
  const graficoVuoto = perMese.every((m) => m.n === 0);

  const classifica = useMemo(() => {
    const ord = [...vendute].filter((r) => r.margine != null).sort((a, b) => b.margine! - a.margine!);
    const top = ord.slice(0, 5);
    const flop = ord.slice(-5).reverse().filter((r) => !top.includes(r));
    return { top, flop };
  }, [vendute]);

  const ordinate = useMemo(() => {
    const valore = (r: VehicleEconomics): number | string => {
      switch (ordine.col) {
        case "auto": return nomeAuto(r);
        case "data": return r.data_vendita ?? r.data_ingresso;
        case "giorni": return r.giorni_stock;
        case "costi": return r.costi_effettivi;
        case "ricavi": return r.venduta ? ricaviNetti(r) : (r.prezzo_riferimento ?? 0);
        case "margine": return r.margine ?? -Infinity;
        case "pct": return r.margine_pct ?? -Infinity;
        case "dopo": return r.margine_dopo_giacenza ?? -Infinity;
      }
    };
    return [...filtrate].sort((a, b) => {
      const va = valore(a);
      const vb = valore(b);
      const c = typeof va === "string" ? va.localeCompare(String(vb), "it") : va - (vb as number);
      return ordine.desc ? -c : c;
    });
  }, [filtrate, ordine]);

  function esportaMargini() {
    const csv = creaCsv(
      [
        "Auto", "Targa", "Tipo", "Regime IVA", "Stato", "Data ingresso", "Data vendita", "Giorni in stock", "Venditore",
        "Prezzo al cliente (IVA incl.)", "IVA sulla vendita", "Ricavi netti", "Costi imponibile", "IVA sui costi", "Costi nel calcolo",
        "Margine lordo", "Margine %", "Costo giacenza", "Margine dopo giacenza", "Prezzo minimo", "Prezzo obiettivo",
      ],
      ordinate.map((r) => [
        nomeAuto(r), r.targa, TIPI_VEICOLO[r.tipo], REGIMI_IVA[r.regime_iva].label, r.venduta ? "Venduta" : STATI_VEICOLO[r.stato].label,
        dataCsv(r.data_ingresso), dataCsv(r.data_vendita), r.giorni_stock, r.venditore_nome,
        r.prezzo_riferimento, r.iva_vendita, r.venduta ? ricaviNetti(r) : r.ricavo_vendita_netto, r.costi_netti, r.costi_iva, r.costi_effettivi,
        r.margine, r.margine_pct, r.costo_giacenza, r.margine_dopo_giacenza, r.prezzo_minimo, r.prezzo_obiettivo,
      ]),
    );
    scaricaCsv(`margini-${nomeFilePeriodo()}.csv`, csv);
    toast.success("File dei margini scaricato");
  }

  async function esportaCosti() {
    setEsportando(true);
    try {
      const voci = await leggiCostiPerEsportazione(ordinate.map((r) => r.vehicle_id));
      const csv = creaCsv(
        ["Data", "Auto", "Targa", "Regime IVA", "Categoria", "Descrizione", "Fornitore", "Imponibile", "Aliquota IVA %", "IVA", "Totale", "Fattura allegata"],
        voci.map((c) => [
          dataCsv(c.data),
          c.vehicles ? `${c.vehicles.marca} ${c.vehicles.modello}${c.vehicles.versione ? ` ${c.vehicles.versione}` : ""}` : "",
          c.vehicles?.targa, c.vehicles ? REGIMI_IVA[c.vehicles.regime_iva].label : "",
          c.categoria, c.descrizione, c.fornitore, c.importo, c.iva_aliquota, c.importo_iva, c.importo_lordo, c.allegato_path ? "Sì" : "No",
        ]),
      );
      scaricaCsv(`costi-${nomeFilePeriodo()}.csv`, csv);
      toast.success(`File dei costi scaricato (${voci.length} voci)`);
    } catch (e) {
      mostraErrore(e, "Esportazione non riuscita. Riprova.");
    } finally {
      setEsportando(false);
    }
  }

  function nomeFilePeriodo() {
    const s = stato === "stock" ? "stock" : `${daIso}_${giornoIso(addDays(range.a, -1))}`;
    return stato === "tutte" ? `${s}-e-stock` : s;
  }

  const ordina = (col: Colonna) => setOrdine((o) => ({ col, desc: o.col === col ? !o.desc : true }));

  return (
    <div>
      <PageHeader
        title="Margini"
        subtitle="Quanto guadagni su ogni auto, al netto di IVA e giacenza."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={esportaMargini} disabled={!ordinate.length}>
              <Download aria-hidden /> Esporta margini (CSV)
            </Button>
            <Button variant="outline" onClick={() => void esportaCosti()} disabled={!ordinate.length || esportando}>
              {esportando ? <Spinner /> : <Download aria-hidden />} Esporta costi (CSV)
            </Button>
          </div>
        }
      />

      {/* Filtri: una riga sopra tutti i numeri */}
      <div className="mb-6 space-y-3">
        <Segmented
          label="Auto da mostrare"
          value={stato}
          onChange={setStato}
          options={[
            { value: "vendute", label: "Vendute" },
            { value: "stock", label: "In stock" },
            { value: "tutte", label: "Tutte" },
          ]}
          className="max-w-md"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select aria-label="Periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} disabled={stato === "stock"}>
            {PERIODI.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
          <Select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoVeicolo | "")}>
            <option value="">Tutti i tipi</option>
            {opzioni(TIPI_VEICOLO).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select aria-label="Marca" value={marca} onChange={(e) => setMarca(e.target.value)}>
            <option value="">Tutte le marche</option>
            {marche.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
          <Select aria-label="Venditore" value={venditore} onChange={(e) => setVenditore(e.target.value)}>
            <option value="">Tutti i venditori</option>
            {venditori.map((p) => (
              <option key={p.user_id} value={p.user_id}>{p.nome}</option>
            ))}
          </Select>
        </div>
        {periodo === "personalizzato" && stato !== "stock" && (
          <div className="grid max-w-md grid-cols-2 gap-3">
            <Input type="date" aria-label="Dal" value={daCustom} onChange={(e) => setDaCustom(e.target.value)} />
            <Input type="date" aria-label="Al" value={aCustom} onChange={(e) => setACustom(e.target.value)} />
          </div>
        )}
        {!rangeValido && stato !== "stock" && <p className="text-[15px] font-medium text-destructive">La data di inizio deve precedere quella di fine.</p>}
        <p className="text-sm text-muted-foreground">
          {stato === "stock"
            ? "Auto ancora in stock: il margine è previsto sul prezzo di listino."
            : `Vendite ${etichettaPeriodo} (per data di vendita)${stato === "tutte" ? " più le auto ancora in stock" : ""}.`}
        </p>
      </div>

      {elenco.isError ? (
        <ErrorState error={elenco.error} onRetry={() => void elenco.refetch()} />
      ) : elenco.isLoading ? (
        <div className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-96" />
        </div>
      ) : !righe.length ? (
        <EmptyState
          art="grafico"
          title="Nessun dato economico ancora"
          text="Registra i costi di acquisto e preparazione nella scheda di ogni auto: qui vedrai margini e redditività."
          action={<Button asChild><Link to="/stock">Vai allo stock</Link></Button>}
        />
      ) : (
        <div className="space-y-6">
          {stato !== "stock" && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={<Car />} value={kpi.n} label="Auto vendute" hint={etichettaPeriodo} />
              <StatCard icon={<Wallet />} value={euro(kpi.ricavi)} label="Ricavi netti IVA" />
              <StatCard icon={<Coins />} tone="gray" value={euro(kpi.costi)} label="Costi" />
              <StatCard icon={<TrendingUp />} tone={kpi.margine < 0 ? "red" : "green"} value={euro(kpi.margine)} label="Margine totale" hint={`dopo la giacenza ${euro(kpi.dopo)}`} />
              <StatCard icon={<TrendingUp />} tone="accent" value={kpi.medio == null ? "—" : euro(kpi.medio)} label="Margine medio per auto" />
              <StatCard icon={<Percent />} tone="accent" value={pct(kpi.medioPct)} label="Margine medio %" />
              <StatCard icon={<Clock />} tone="yellow" value={kpi.giorni == null ? "—" : Math.round(kpi.giorni)} label="Giorni medi in stock" />
              {stato === "tutte" ? (
                <StatCard icon={<Car />} tone="gray" value={inStock.length} label="Auto in stock" hint={`margine previsto ${euro(kpi.stockMargine)}`} />
              ) : (
                <StatCard icon={<TrendingDown />} tone="red" value={vendute.filter((r) => (r.margine ?? 0) < 0).length} label="Vendute in perdita" />
              )}
            </div>
          )}
          {stato === "stock" && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={<Car />} value={inStock.length} label="Auto in stock" />
              <StatCard icon={<Coins />} tone="gray" value={euro(kpi.stockCosti)} label="Capitale investito (costi)" />
              <StatCard icon={<TrendingUp />} tone="green" value={euro(kpi.stockMargine)} label="Margine previsto a listino" />
              <StatCard icon={<TrendingDown />} tone="red" value={inStock.filter((r) => r.semaforo === "rosso").length} label="In perdita a listino" />
            </div>
          )}

          <GraficoMesi dati={perMese} vuoto={graficoVuoto} />

          {stato !== "stock" && classifica.top.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Classifica titolo="Le più redditizie" icona={<TrendingUp className="size-5 text-success" aria-hidden />} righe={classifica.top} />
              <Classifica
                titolo="Le meno redditizie"
                icona={<TrendingDown className="size-5 text-warning" aria-hidden />}
                righe={classifica.flop}
                vuoto="Servono almeno 6 vendite per confrontare le meno redditizie."
              />
            </div>
          )}

          <Section title="Dettaglio per auto" count={ordinate.length} bodyClassName="p-0 sm:p-0">
            {!ordinate.length ? (
              <EmptyState compact art="ricerca" title="Nessuna auto con questi filtri" text="Prova un periodo più ampio o togli qualche filtro." />
            ) : (
              <>
                <ul className="divide-y md:hidden">
                  {ordinate.map((r) => (
                    <li key={r.vehicle_id}>
                      <Link to={`/stock/${r.vehicle_id}?tab=economia`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                        <div className="min-w-0">
                          <p className="font-semibold">{nomeAuto(r)}</p>
                          <p className="text-sm text-muted-foreground">
                            {r.venduta ? `Venduta ${dataBreve(r.data_vendita)}` : "In stock"} · {r.giorni_stock} gg
                          </p>
                          <div className="mt-1"><Semaforo valore={r.semaforo} breve /></div>
                        </div>
                        <div className="text-right tabular-nums">
                          <p className={cn("font-semibold", (r.margine ?? 0) < 0 && "text-destructive")}>{euro(r.margine)}</p>
                          <p className="text-sm text-muted-foreground">{pct(r.margine_pct)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-[15px]">
                    <thead className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
                      <tr>
                        <Th col="auto" ordine={ordine} onClick={ordina}>Auto</Th>
                        <Th col="data" ordine={ordine} onClick={ordina}>Venduta il</Th>
                        <Th col="giorni" ordine={ordine} onClick={ordina} destra>Giorni</Th>
                        <Th col="costi" ordine={ordine} onClick={ordina} destra>Costi</Th>
                        <Th col="ricavi" ordine={ordine} onClick={ordina} destra>Ricavi netti</Th>
                        <Th col="margine" ordine={ordine} onClick={ordina} destra>Margine</Th>
                        <Th col="pct" ordine={ordine} onClick={ordina} destra>%</Th>
                        <Th col="dopo" ordine={ordine} onClick={ordina} destra>Dopo giacenza</Th>
                        <th className="px-4 py-2.5 font-medium">Esito</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ordinate.map((r) => (
                        <tr key={r.vehicle_id} className="hover:bg-muted/40">
                          <td className="px-4 py-2.5">
                            <Link to={`/stock/${r.vehicle_id}?tab=economia`} className="font-medium hover:text-accent hover:underline">
                              {nomeAuto(r)}
                            </Link>
                            <span className="block text-sm text-muted-foreground">
                              {[r.targa, TIPI_VEICOLO[r.tipo], REGIMI_IVA[r.regime_iva].label, r.venditore_nome].filter(Boolean).join(" · ")}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5">{r.venduta ? dataBreve(r.data_vendita) : <span className="text-muted-foreground">In stock</span>}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{r.giorni_stock}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{euro(r.costi_effettivi)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {r.venduta ? euro(ricaviNetti(r)) : <span className="text-muted-foreground" title="Previsto sul listino">{euro(r.ricavo_vendita_netto)}*</span>}
                          </td>
                          <td className={cn("px-4 py-2.5 text-right font-semibold tabular-nums", (r.margine ?? 0) < 0 && "text-destructive")}>{euro(r.margine)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{pct(r.margine_pct)}</td>
                          <td className={cn("px-4 py-2.5 text-right tabular-nums", (r.margine_dopo_giacenza ?? 0) < 0 && "text-destructive")}>{euro(r.margine_dopo_giacenza)}</td>
                          <td className="px-4 py-2.5"><Semaforo valore={r.semaforo} breve /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {inStock.length > 0 && <p className="border-t px-4 py-2.5 text-sm text-muted-foreground">* Auto in stock: ricavo e margine previsti sul prezzo di listino.</p>}
                </div>
              </>
            )}
          </Section>

          <p className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-[15px] text-muted-foreground">
            <Info className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <span>
              I file CSV si aprono direttamente in Excel (separatore punto e virgola). Margini al netto dell'IVA secondo il regime di ogni auto.{" "}
              {NOTA_COMMERCIALISTA}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function Th({
  col,
  ordine,
  onClick,
  destra,
  children,
}: {
  col: Colonna;
  ordine: { col: Colonna; desc: boolean };
  onClick: (c: Colonna) => void;
  destra?: boolean;
  children: React.ReactNode;
}) {
  const attiva = ordine.col === col;
  const Icona = !attiva ? ArrowUpDown : ordine.desc ? ArrowDown : ArrowUp;
  return (
    <th className={cn("px-4 py-2.5 font-medium", destra && "text-right")} aria-sort={attiva ? (ordine.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => onClick(col)} className={cn("inline-flex items-center gap-1 hover:text-foreground", attiva && "text-foreground")}>
        {children}
        <Icona className="size-3.5" aria-hidden />
      </button>
    </th>
  );
}

function GraficoMesi({ dati, vuoto }: { dati: { etichetta: string; medio: number | null; n: number }[]; vuoto: boolean }) {
  return (
    <Section title="Margine medio per auto venduta, ultimi 12 mesi">
      {vuoto ? (
        <EmptyState compact art="grafico" title="Nessuna vendita negli ultimi 12 mesi" text="Il grafico si riempie man mano che chiudi le vendite." />
      ) : (
        <>
          <div className="h-72" role="img" aria-label="Grafico a barre del margine medio per mese">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dati} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke={C.griglia} />
                <XAxis dataKey="etichetta" tickLine={false} axisLine={false} tick={{ fill: C.asse, fontSize: 13 }} interval={0} angle={0} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tick={{ fill: C.asse, fontSize: 13 }}
                  tickFormatter={(v: number) => euro(v)}
                />
                <ReferenceLine y={0} stroke={C.zero} />
                <Tooltip
                  cursor={{ fill: "rgb(47 107 255 / 0.06)" }}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e5e9f0", boxShadow: "0 8px 24px rgb(13 21 38 / 0.12)", fontSize: 14 }}
                  labelStyle={{ fontWeight: 600, color: "#0d1526" }}
                  formatter={(v, _n, item) => [`${euro(Number(v))} su ${(item.payload as { n: number }).n} auto`, "Margine medio"]}
                />
                <Bar dataKey="medio" radius={[4, 4, 4, 4]} maxBarSize={40}>
                  {dati.map((d) => (
                    <Cell key={d.etichetta} fill={(d.medio ?? 0) < 0 ? C.negativo : C.positivo} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3 text-[15px]">
            <summary className="cursor-pointer font-medium text-accent">Mostra i valori in tabella</summary>
            <table className="mt-2 w-full max-w-md text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-1 font-medium">Mese</th><th className="py-1 text-right font-medium">Auto vendute</th><th className="py-1 text-right font-medium">Margine medio</th></tr>
              </thead>
              <tbody className="divide-y">
                {dati.map((d) => (
                  <tr key={d.etichetta}><td className="py-1">{d.etichetta}</td><td className="py-1 text-right tabular-nums">{d.n}</td><td className="py-1 text-right tabular-nums">{euro(d.medio)}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </Section>
  );
}

function Classifica({ titolo, icona, righe, vuoto }: { titolo: string; icona: React.ReactNode; righe: VehicleEconomics[]; vuoto?: string }) {
  return (
    <Section title={<span className="flex items-center gap-2">{icona}{titolo}</span>} bodyClassName="p-0 sm:p-0">
      {!righe.length ? (
        <p className="p-4 text-[15px] text-muted-foreground">{vuoto}</p>
      ) : (
        <ol className="divide-y">
          {righe.map((r, i) => (
            <li key={r.vehicle_id}>
              <Link to={`/stock/${r.vehicle_id}?tab=economia`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 sm:px-5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{nomeAuto(r)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {dataBreve(r.data_vendita)} · {r.giorni_stock} gg{r.venditore_nome ? ` · ${r.venditore_nome}` : ""}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className={cn("block font-semibold", (r.margine ?? 0) < 0 && "text-destructive")}>{euro(r.margine)}</span>
                  <span className="block text-sm text-muted-foreground">{pct(r.margine_pct)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
