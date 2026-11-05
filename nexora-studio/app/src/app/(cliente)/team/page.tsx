import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Team" };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Team"
        description="Le persone della tua azienda che usano Nexora Studio."
      />
      <EmptyState
        icon={Users}
        title="Lavori da solo, per ora"
        description="Invita un collaboratore: potrà caricare i video, approvarli e vedere il calendario."
        action={
          <Button variant="outline" asChild>
            <Link href="/inizio">Torna alla Home</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
