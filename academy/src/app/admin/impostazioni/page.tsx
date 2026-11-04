import { Settings } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader title="Impostazioni" />
      <EmptyState
        icon={Settings}
        title="Impostazioni"
        description="Dati del tenant, marchio e integrazioni."
      />
    </div>
  );
}
