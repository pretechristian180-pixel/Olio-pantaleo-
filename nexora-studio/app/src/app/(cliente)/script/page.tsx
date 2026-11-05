import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Script" };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Script"
        description="Gli script dei video da girare questa settimana, con i consigli di ripresa."
      />
      <EmptyState
        icon={FileText}
        title="Gli script arrivano ogni lunedì"
        description="Prepariamo gli script in base al tuo brand e ti mandiamo un'email il lunedì mattina."
        action={
          <Button variant="outline" asChild>
            <Link href="/brand">Completa il brand</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
