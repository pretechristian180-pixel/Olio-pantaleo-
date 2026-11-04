import { TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";

// Fase 1: struttura. I numeri arrivano dalle viste aggregate in Fase 4.
export default function AdminOverviewPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader eyebrow="Panoramica" title="Come va l'Academy" />
      <section aria-label="Numeri principali" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Vendite del mese" value="0 €" />
        <Stat label="Studenti attivi" value={0} hint="Ultimi 30 giorni" />
        <Stat label="Completamento medio" value="0%" />
        <Stat label="Iscrizioni totali" value={0} />
      </section>
      <EmptyState
        icon={TrendingDown}
        title="Lezione con più abbandoni"
        description="Appena gli studenti iniziano a guardare le lezioni, qui vedi dove si fermano."
      />
    </div>
  );
}
