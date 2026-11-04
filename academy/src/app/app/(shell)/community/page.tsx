import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Community" />
      <EmptyState
        icon={Users}
        title="Community in arrivo"
        description="Qui troverai le domande degli altri studenti e le risposte del docente."
      />
    </div>
  );
}
