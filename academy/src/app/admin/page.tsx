import { PageHeader } from "@/components/layout/page-header";
import { AdminStats } from "@/components/admin/admin-stats";

// Fase 1: struttura. I numeri arrivano dalle viste aggregate in Fase 4.
export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Panoramica" title="Come va l'Academy" />
      <AdminStats
        n={{
          venditeMeseCents: null,
          studentiAttivi: null,
          completamentoMedio: null,
          lezioneAbbandoni: null,
        }}
      />
    </div>
  );
}
