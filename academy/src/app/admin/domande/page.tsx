import { MessageCircleQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Domande" />
      <EmptyState
        icon={MessageCircleQuestion}
        title="Nessuna domanda da rispondere"
        description="Quando uno studente fa una domanda la trovi qui, in ordine di arrivo."
      />
    </div>
  );
}
