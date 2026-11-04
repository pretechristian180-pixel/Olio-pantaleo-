import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Studenti" />
      <EmptyState
        icon={Users}
        title="Nessuno studente"
        description="Iscrizioni, avanzamento e accesso manuale arrivano in Fase 4."
      />
    </div>
  );
}
