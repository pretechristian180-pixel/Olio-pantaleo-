import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Piano e fatturazione" };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Piano e fatturazione"
        description="Il tuo piano, quanto hai usato questo mese e le fatture."
      />
      <EmptyState
        icon={CreditCard}
        title="Sei nella prova gratuita"
        description="Hai 3 video montati gratis. Quando vuoi, scegli il piano più adatto."
        action={
          <Button variant="outline" asChild>
            <Link href="/inizio">Torna alla Home</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
