import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Video" };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Video"
        description="I tuoi video: in montaggio, da approvare, approvati e pubblicati."
      />
      <EmptyState
        icon={Clapperboard}
        title="Ancora nessun video"
        description="Carica il primo girato: lo montiamo noi e te lo mandiamo da approvare."
        action={
          <Button variant="outline" asChild>
            <Link href="/video/carica">Carica il video</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
