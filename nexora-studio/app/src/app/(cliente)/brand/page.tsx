import type { Metadata } from "next";
import Link from "next/link";
import { Palette } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Brand" };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Brand" description="Come parla la tua azienda e come vuoi i tuoi video." />
      <EmptyState
        icon={Palette}
        title="Racconta il tuo brand"
        description="Logo, colori, tono di voce e video di esempio: servono all'AI per fare video che ti somigliano."
        action={
          <Button variant="outline" asChild>
            <Link href="/inizio">Torna alla Home</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
