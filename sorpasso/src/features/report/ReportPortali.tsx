import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton } from "@/components/shared/States";
import { EmptyState } from "@/components/shared/EmptyState";
import { euro, numero } from "@/lib/format";
import { useReportPortali } from "@/features/pubblicazione/portaliApi";

/*
 * Una sola serie (contatti per portale): niente legenda, il titolo la nomina.
 * Costi e costo per lead/vendita hanno un'altra scala: stanno nella tabella, mai su un secondo asse.
 * Colore validato con lo script dataviz (contrasto ≥ 3:1 su bianco).
 */
const C = { serie: "#3d6bff", griglia: "#e5e9f0", asse: "#5b6578", testo: "#0d1526" };
const tick = { fill: C.asse, fontSize: 13 };

/** Report → Portali: auto pubblicate, contatti, vendite e costo per lead/vendita nel periodo scelto. */
export function ReportPortali({ da, a }: { da: Date; a: Date }) {
  const q = useReportPortali(da.toISOString(), a.toISOString());
  const righe = (q.data ?? []).filter((r) => r.attivo || r.contatti > 0 || r.auto_pubblicate > 0);

  return (
    <Section title="Portali" className="mt-6" bodyClassName="p-0">
      {q.isLoading ? (
        <div className="p-4">
          <ListSkeleton rows={3} />
        </div>
      ) : q.error ? (
        <div className="p-4">
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        </div>
      ) : righe.length === 0 ? (
        <EmptyState
          art="grafico"
          compact
          title="Nessun portale attivo nel periodo"
          text="Attiva i portali per vedere contatti e costo per lead di ciascuno."
          action={<Link to="/impostazioni?tab=portali" className="font-semibold text-accent">Vai ai portali</Link>}
        />
      ) : (
        <>
          <div className="p-2 sm:p-4">
            <p className="px-2 pb-1 text-[15px] font-medium">Contatti ricevuti per portale</p>
            <div style={{ height: 240 }} role="img" aria-label={`Contatti per portale: ${righe.map((r) => `${r.portale} ${r.contatti}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={righe} margin={{ top: 22, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.griglia} />
                  <XAxis dataKey="portale" tick={tick} tickLine={false} axisLine={{ stroke: C.griglia }} interval={0} tickFormatter={(v: string) => v.replace(/ \(.*\)$/, "").replace("Sito della concessionaria", "Sito")} />
                  <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgb(61 107 255 / 0.06)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e5e9f0", boxShadow: "0 8px 24px rgb(13 21 38 / 0.12)", fontSize: 14 }}
                    labelStyle={{ fontWeight: 600, color: C.testo }}
                    itemStyle={{ color: C.testo }}
                    formatter={(v) => [v, "Contatti"]}
                  />
                  <Bar dataKey="contatti" name="Contatti" fill={C.serie} radius={[4, 4, 0, 0]} maxBarSize={40}>
                    <LabelList dataKey="contatti" position="top" style={{ fill: C.asse, fontSize: 13 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="overflow-x-auto border-t">
            <table className="w-full min-w-[640px] text-[15px]">
              <thead className="bg-muted/60 text-left text-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Portale</th>
                  <th className="px-3 py-2.5 text-right font-medium">Auto pubblicate</th>
                  <th className="px-3 py-2.5 text-right font-medium">Contatti</th>
                  <th className="px-3 py-2.5 text-right font-medium">Vendite</th>
                  <th className="px-3 py-2.5 text-right font-medium">Costo</th>
                  <th className="px-3 py-2.5 text-right font-medium">Costo per lead</th>
                  <th className="px-4 py-2.5 text-right font-medium">Costo per vendita</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {righe.map((r) => (
                  <tr key={r.portal_id}>
                    <td className="px-4 py-2.5 font-medium">
                      {r.portale}
                      {!r.attivo && <span className="ml-1.5 text-sm font-normal text-muted-foreground">(spento)</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">{numero(r.auto_pubblicate)}</td>
                    <td className="px-3 py-2.5 text-right">{numero(r.contatti)}</td>
                    <td className="px-3 py-2.5 text-right">{numero(r.vendite)}</td>
                    <td className="px-3 py-2.5 text-right">{r.costo > 0 ? euro(r.costo) : "—"}</td>
                    <td className="px-3 py-2.5 text-right">{r.costo > 0 && r.costo_per_lead != null ? euro(r.costo_per_lead) : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{r.costo > 0 && r.costo_per_vendita != null ? euro(r.costo_per_vendita) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t px-4 py-3 text-sm text-muted-foreground">
            Il costo è l'abbonamento mensile del portale (Impostazioni → Portali) ripartito sui giorni del periodo.
            «—» quando il costo non è impostato o non ci sono lead o vendite da dividere.
          </p>
        </>
      )}
    </Section>
  );
}
