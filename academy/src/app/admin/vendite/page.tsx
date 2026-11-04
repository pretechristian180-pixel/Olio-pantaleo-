import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Vendite" />
      <EmptyState
        icon={Receipt}
        title="Nessuna vendita"
        description="Gli ordini Stripe compaiono qui dalla Fase 3."
      />
    </div>
  );
}
