import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader title="I miei corsi" />
      <EmptyState
        icon={BookOpen}
        title="Nessun corso, per ora"
        description="I corsi che acquisti compaiono qui con il tuo avanzamento."
      />
    </div>
  );
}
