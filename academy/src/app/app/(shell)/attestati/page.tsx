import { Award } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Attestati" />
      <EmptyState
        icon={Award}
        title="Nessun attestato"
        description="Completa un corso al 100% e trovi qui il tuo attestato, con il codice per verificarlo."
      />
    </div>
  );
}
