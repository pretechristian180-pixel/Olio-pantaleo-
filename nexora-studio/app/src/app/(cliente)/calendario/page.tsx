import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Calendario" };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Calendario"
        description="Quando escono i tuoi post. Puoi spostarli quando vuoi."
      />
      <EmptyState
        icon={CalendarDays}
        title="Il calendario è vuoto"
        description="I video approvati vengono programmati nei giorni e negli orari che preferisci."
        action={
          <Button variant="outline" asChild>
            <Link href="/video">Vai ai video</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
