import type { Metadata } from "next";
import { Smartphone, Upload } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Carica il video" };

export default function CaricaPage() {
  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title="Carica il video"
        description="Scegli il video dal telefono o dal computer. Lo montiamo noi."
      />
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-nx-blue-500/40 bg-accent/40 px-6 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow">
          <Upload className="size-6" aria-hidden />
        </div>
        <div className="grid gap-1">
          <p className="font-display text-lg font-semibold">Trascina qui il video</p>
          <p className="text-sm text-muted-foreground">
            oppure sceglilo dalla galleria. Fino a 10 minuti.
          </p>
        </div>
        <Button variant="brand" size="lg" disabled>
          Scegli il video
        </Button>
      </div>
      <Alert variant="info">
        <Smartphone aria-hidden />
        <AlertTitle>Gira in verticale</AlertTitle>
        <AlertDescription>
          Tieni il telefono in verticale: i video per i social sono 9:16. Se giri in orizzontale te
          lo segnaliamo prima del montaggio.
        </AlertDescription>
      </Alert>
    </PageContainer>
  );
}
