import type { Metadata } from "next";
import { Download, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { getOrders, getOverview } from "@/lib/data/admin-panel";
import { formatDate } from "@/lib/format-date";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Vendite" };

const STATI = {
  pagato: { label: "Pagato", tone: "positive" },
  rimborsato: { label: "Rimborsato", tone: "neutral" },
  fallito: { label: "Non riuscito", tone: "negative" },
  in_attesa: { label: "In attesa", tone: "neutral" },
} as const;

export default async function SalesPage() {
  const [orders, n] = await Promise.all([getOrders(), getOverview()]);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Vendite"
        description="Gli acquisti dei tuoi corsi. I soldi arrivano direttamente sul tuo conto Stripe."
        actions={
          orders.length ? (
            <Button asChild variant="secondary">
              <a href="/admin/vendite/csv" download>
                <Download aria-hidden /> Esporta CSV
              </a>
            </Button>
          ) : null
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Questo mese" value={formatPrice(n.vendite_mese_cents, "EUR")} />
        <Stat label="Ordini del mese" value={n.ordini_mese} />
        <Stat label="Totale incassato" value={formatPrice(n.vendite_totali_cents, "EUR")} />
      </div>
      {orders.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Ancora nessuna vendita"
          description="Quando uno studente compra un corso lo trovi qui, con importo e stato del pagamento."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="border-b border-line text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Corso</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 text-right font-medium">Importo</th>
                <th className="px-4 py-3 font-medium">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(o.pagato_il ?? o.creato_il)}
                  </td>
                  <td className="px-4 py-3 font-semibold">{o.corso ?? "Corso eliminato"}</td>
                  <td className="px-4 py-3 text-ink-muted">{o.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                    {formatPrice(o.importo_cents, o.valuta)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATI[o.stato].tone}>{STATI[o.stato].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
