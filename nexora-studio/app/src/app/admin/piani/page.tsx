import type { Metadata } from "next";
import { Info } from "lucide-react";

import { PlanForm } from "@/components/admin/plan-form";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Piani", robots: { index: false } };

/** Limiti e prezzi dei piani, letti da tutta l'app dalla tabella plans. */
export default async function PianiPage() {
  await requireAdmin("/admin/piani");
  const { data: plans } = await createAdminClient().from("plans").select("*").order("sort_order");
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Piani"
        description="I limiti valgono da subito per tutti gli abbonati; i prezzi solo per i nuovi abbonamenti."
      />
      <Alert variant="info">
        <Info aria-hidden />
        <AlertDescription>
          Dopo un cambio di prezzo lancia <code>npm run stripe:setup</code>: crea il nuovo prezzo su
          Stripe. Chi è già abbonato mantiene il suo prezzo. Prezzi in centesimi, IVA esclusa (7900
          = 79 €).
        </AlertDescription>
      </Alert>
      <div className="grid gap-4">
        {(plans ?? []).map((p) => (
          <PlanForm key={p.id} plan={p} />
        ))}
      </div>
    </PageContainer>
  );
}
