import { User } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Profilo" />
      <EmptyState
        icon={User}
        title="Profilo"
        description="Qui modifichi i tuoi dati, il consenso marketing e scarichi o cancelli i tuoi dati. Arriva in Fase 2."
      />
    </div>
  );
}
