import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Car, Clock, Euro, Percent, Target, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Section } from "@/components/shared/Section";
import { StatCard } from "@/components/shared/StatCard";
import { ErrorState } from "@/components/shared/States";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Select } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import { FONTI } from "@/lib/labels";
import { addDays, durata, euro, numero, startOfDay, startOfMonth, toDateInput } from "@/lib/format";
import type { ReportPeriodo } from "@/types/db";
import { ReportPortali } from "./ReportPortali";

/*
 * Colori dei grafici (validati con lo script dataviz: CVD e contrasto ok su bianco).
 * Serie 1 = lead (blu elettrico), serie 2 = vinti (arancio). Testo sempre in inchiostro neutro.
 */
const C = {
  serie1: "#3d6bff",
  serie2: "#eb6834",
  griglia: "#e5e9f0",
  asse: "#5b6578",
};

type Periodo = "mese" | "mese_scorso" | "3_mesi" | "anno" | "personalizzato";
const PERIODI: { value: Periodo; label: string }[] = [
  { value: "mese", label: "Questo mese" },
  { value: "mese_scorso", label: "Mese scorso" },
  { value: "3_mesi", label: "Ultimi 3 mesi" },
  { value: "anno", label: "Quest'anno" },
  { value: "personalizzato", label: "Personalizzato" },
];

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

const NOMI_MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const etichettaMese = (m: string) => {
  const [anno, mese] = m.split("-");
  return `${NOMI_MESI[Number(mese) - 1]} ${anno!.slice(2)}`;
};

const tooltipStyle = {
  contentStyle: { borderRadius: 10, border: "1px solid #e5e9f0", boxShadow: "0 8px 24px rgb(13 21 38 / 0.12)", fontSize: 14 },
  labelStyle: { fontWeight: 600, color: "#0d1526" },
  itemStyle: { color: "#0d1526" },
  cursor: { fill: "rgb(61 107 255 / 0.06)" },
};
const tick = { fill: C.asse, fontSize: 13 };

export default function ReportPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mese");
  const [daCustom, setDaCustom] = useState(toDateInput(addDays(new Date(), -30)));
  const [aCustom, setACustom] = useState(toDateInput(new Date()));
  const range = useMemo(() => intervallo(periodo, daCustom, aCustom), [periodo, daCustom, aCustom]);
  const valido = range.da < range.a && !Number.isNaN(range.da.getTime()) && !Number.isNaN(range.a.getTime());

  const q = useQuery({
    queryKey: [...qk.report, range.da.toISOString(), range.a.toISOString()],
    enabled: valido,
    queryFn: async () =>
      ok(await supabase.rpc("report_periodo", { p_da: range.da.toISOString(), p_a: range.a.toISOString() })) as ReportPeriodo,
  });
  const r = q.data;

  const perFonte = (r?.per_fonte ?? []).map((f) => ({ ...f, nome: FONTI[f.fonte] ?? f.fonte }));
  const perMese = (r?.per_mese ?? []).map((m) => ({ ...m, nome: etichettaMese(m.mese) }));
  const motivi = [...(r?.motivi_perso ?? [])].sort((a, b) => b.lead - a.lead);

  return (
    <div>
      <PageHeader title="Report" subtitle="Da dove arrivano i clienti, chi vende e perché si perde." />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <label htmlFor="rp-periodo" className="mb-2 block text-[15px] font-medium">
            Periodo
          </label>
          <Select id="rp-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            {PERIODI.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        {periodo === "personalizzato" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rp-da" className="mb-2 block text-[15px] font-medium">
                Dal
              </label>
              <Input id="rp-da" type="date" value={daCustom} onChange={(e) => setDaCustom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rp-a" className="mb-2 block text-[15px] font-medium">
                Al
              </label>
              <Input id="rp-a" type="date" value={aCustom} onChange={(e) => setACustom(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {!valido ? (
        <p role="alert" className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[15px] text-warning">
          Controlla le date: la data di inizio deve essere prima di quella di fine.
        </p>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isLoading || !r ? (
        <div className="space-y-6" aria-busy="true" aria-label="Caricamento">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={<Target />} tone="accent" value={numero(r.lead_ricevuti)} label="Lead ricevuti" />
            <StatCard icon={<Percent />} tone="blue" value={`${numero(r.tasso_conversione)}%`} label="Conversione" hint={`${r.lead_vinti} vinti · ${r.lead_persi} persi`} />
            <StatCard icon={<Car />} tone="green" value={numero(r.auto_vendute)} label="Auto vendute" />
            <StatCard icon={<Euro />} tone="blue" value={euro(r.fatturato)} label="Fatturato vendite" />
            <StatCard icon={<Clock />} tone="yellow" value={durata(r.tempo_medio_risposta_min)} label="Tempo medio di prima risposta" />
            <StatCard icon={<Warehouse />} tone="gray" value={r.giacenza_media_giorni == null ? "—" : `${r.giacenza_media_giorni} gg`} label="Giacenza media stock" hint="Auto non vendute, oggi" />
          </div>

          {r.lead_ricevuti === 0 && r.auto_vendute === 0 ? (
            <Section title="Nessun dato nel periodo">
              <EmptyState art="grafico" compact title="Ancora niente da mostrare" text="Prova un periodo più ampio, oppure inserisci i primi lead: i grafici si riempiranno da soli." />
            </Section>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Lead per fonte" bodyClassName="p-2 sm:p-4">
                  {perFonte.length === 0 ? (
                    <EmptyState art="grafico" compact title="Nessun lead nel periodo" />
                  ) : (
                    <>
                      <div className="h-72" role="img" aria-label="Grafico a barre dei lead ricevuti e vinti per fonte">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={perFonte} margin={{ top: 20, right: 8, left: -16, bottom: 0 }} barGap={2}>
                            <CartesianGrid vertical={false} stroke={C.griglia} />
                            <XAxis dataKey="nome" tick={tick} tickLine={false} axisLine={{ stroke: C.griglia }} interval={0} angle={-30} textAnchor="end" height={60} />
                            <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                            <Tooltip {...tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: 14, color: C.asse }} />
                            <Bar dataKey="lead" name="Lead" fill={C.serie1} radius={[4, 4, 0, 0]} maxBarSize={28}>
                              <LabelList dataKey="lead" position="top" style={{ fill: C.asse, fontSize: 12 }} />
                            </Bar>
                            <Bar dataKey="vinti" name="Vinti" fill={C.serie2} radius={[4, 4, 0, 0]} maxBarSize={28} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <TabellaFonti righe={perFonte} />
                    </>
                  )}
                </Section>

                <Section title="Andamento mensile" bodyClassName="p-2 sm:p-4">
                  {perMese.length === 0 ? (
                    <EmptyState art="grafico" compact title="Nessun lead nel periodo" />
                  ) : (
                    <div className="h-72" role="img" aria-label="Grafico a barre di lead ricevuti e vinti per mese">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={perMese} margin={{ top: 20, right: 8, left: -16, bottom: 0 }} barGap={2}>
                          <CartesianGrid vertical={false} stroke={C.griglia} />
                          <XAxis dataKey="nome" tick={tick} tickLine={false} axisLine={{ stroke: C.griglia }} />
                          <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 14, color: C.asse }} />
                          <Bar dataKey="lead" name="Lead" fill={C.serie1} radius={[4, 4, 0, 0]} maxBarSize={36} />
                          <Bar dataKey="vinti" name="Vinti" fill={C.serie2} radius={[4, 4, 0, 0]} maxBarSize={36} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Section>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Classifica venditori" bodyClassName="p-0">
                  {r.per_venditore.length === 0 ? (
                    <EmptyState art="persone" compact title="Nessun lead assegnato nel periodo" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[15px]">
                        <thead className="bg-muted text-left text-sm text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2.5 font-medium">Venditore</th>
                            <th className="px-3 py-2.5 text-right font-medium">Lead</th>
                            <th className="px-3 py-2.5 text-right font-medium">Vinti</th>
                            <th className="px-3 py-2.5 text-right font-medium">Aperti</th>
                            <th className="px-3 py-2.5 text-right font-medium">Conv.</th>
                            <th className="px-4 py-2.5 text-right font-medium">Risposta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.per_venditore.map((v, i) => (
                            <tr key={`${v.venditore}-${i}`} className="border-t">
                              <td className="px-4 py-3 font-medium">
                                <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                                {v.venditore}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums">{v.lead}</td>
                              <td className="px-3 py-3 text-right font-semibold tabular-nums">{v.vinti}</td>
                              <td className="px-3 py-3 text-right tabular-nums">{v.aperti}</td>
                              <td className="px-3 py-3 text-right tabular-nums">{v.lead ? `${Math.round((v.vinti / v.lead) * 100)}%` : "—"}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{durata(v.risposta_min)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                <Section title="Motivi di perdita" bodyClassName="p-2 sm:p-4">
                  {motivi.length === 0 ? (
                    <EmptyState art="fatto" compact title="Nessun lead perso nel periodo" />
                  ) : (
                    <div style={{ height: Math.max(160, motivi.length * 44 + 20) }} role="img" aria-label="Grafico a barre orizzontali dei motivi di perdita">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={motivi} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 4 }}>
                          <CartesianGrid horizontal={false} stroke={C.griglia} />
                          <XAxis type="number" allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="motivo" width={150} tick={tick} tickLine={false} axisLine={false} />
                          <Tooltip {...tooltipStyle} formatter={(v) => [v, "Lead persi"]} />
                          <Bar dataKey="lead" name="Lead persi" fill={C.serie1} radius={[0, 4, 4, 0]} maxBarSize={24}>
                            <LabelList dataKey="lead" position="right" style={{ fill: C.asse, fontSize: 13 }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Section>
              </div>
            </>
          )}
        </div>
      )}
      {valido && <ReportPortali da={range.da} a={range.a} />}
    </div>
  );
}

/** Conversione per fonte in tabella: leggibile anche senza colori. */
function TabellaFonti({ righe }: { righe: { nome: string; lead: number; vinti: number; conversione: number }[] }) {
  return (
    <table className="mt-2 w-full text-[15px]">
      <caption className="sr-only">Conversione per fonte</caption>
      <thead className="text-left text-sm text-muted-foreground">
        <tr>
          <th className="px-2 py-2 font-medium">Fonte</th>
          <th className="px-2 py-2 text-right font-medium">Lead</th>
          <th className="px-2 py-2 text-right font-medium">Vinti</th>
          <th className="px-2 py-2 text-right font-medium">Conversione</th>
        </tr>
      </thead>
      <tbody>
        {righe.map((f) => (
          <tr key={f.nome} className="border-t">
            <td className="px-2 py-2">{f.nome}</td>
            <td className="px-2 py-2 text-right tabular-nums">{f.lead}</td>
            <td className="px-2 py-2 text-right tabular-nums">{f.vinti}</td>
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{numero(f.conversione)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
