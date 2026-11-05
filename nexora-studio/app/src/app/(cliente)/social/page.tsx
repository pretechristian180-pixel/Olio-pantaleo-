import type { Metadata } from "next";
import Link from "next/link";
import { Share2 } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Social" };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Social" description="Gli account su cui pubblichiamo i tuoi video." />
      <EmptyState
        icon={Share2}
        title="Nessun social collegato"
        description="Collega Instagram, Facebook, TikTok, YouTube o LinkedIn: pubblicheremo solo i video che approvi."
        action={
          <Button variant="outline" asChild>
            <Link href="/inizio">Torna alla Home</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
