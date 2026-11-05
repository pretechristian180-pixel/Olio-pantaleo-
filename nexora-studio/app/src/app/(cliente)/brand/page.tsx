import type { Metadata } from "next";
import type { EditStyle } from "@nexora/shared";

import { BrandForm } from "@/components/brand-forms/brand-form";
import { CompanyForm } from "@/components/brand-forms/company-form";
import { EditStyleForm } from "@/components/brand-forms/edit-style-form";
import { ExamplesForm } from "@/components/brand-forms/examples-form";
import { PublishingForm } from "@/components/brand-forms/publishing-form";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Brand" };

const sections = [
  { id: "azienda", label: "Azienda" },
  { id: "brand", label: "Brand" },
  { id: "stile", label: "Stile video" },
  { id: "esempi", label: "Esempi" },
  { id: "pubblicazione", label: "Pubblicazione" },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20 lg:scroll-mt-8">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function BrandPage() {
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;
  const isOwner = ctx.active.role === "owner";

  const supabase = await createClient();
  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("workspace_id", ws.id)
    .single();
  const logoUrl = await signedUrl("brand", ws.logo_url);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Brand"
        description="Come parla la tua azienda e come vuoi i tuoi video. Più è preciso, più i video ti somigliano."
      />
      <nav aria-label="Sezioni" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex h-9 items-center rounded-full border bg-card px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section
        id="azienda"
        title="Azienda"
        description={
          isOwner
            ? "I dati principali della tua attività."
            : "Solo il titolare può modificare questi dati."
        }
      >
        <CompanyForm workspace={ws} mode="settings" readOnly={!isOwner} />
      </Section>

      <Section
        id="brand"
        title="Brand"
        description="Logo, colori e il modo in cui parli ai clienti."
      >
        {brand && (
          <BrandForm
            workspace={ws}
            brand={brand}
            logoUrl={logoUrl}
            mode="settings"
            canEditVisuals={isOwner}
          />
        )}
      </Section>

      <Section
        id="stile"
        title="Stile di montaggio"
        description="Come vuoi i video montati. Dopo i primi montaggi l'AI affina queste scelte con i tuoi video di esempio."
      >
        <EditStyleForm workspaceId={ws.id} style={(brand?.edit_style ?? {}) as EditStyle} />
      </Section>

      <Section
        id="esempi"
        title="Video di esempio"
        description="Da 1 a 3 video con lo stile che ti piace, anche di altri."
      >
        <ExamplesForm
          workspaceId={ws.id}
          initialPaths={brand?.reference_videos ?? []}
          mode="settings"
        />
      </Section>

      <Section
        id="pubblicazione"
        title="Pubblicazione"
        description={
          isOwner
            ? "Quanti video a settimana e quando escono. Il numero di script settimanali segue questa scelta."
            : "Solo il titolare può modificare la frequenza di pubblicazione."
        }
      >
        <PublishingForm workspace={ws} mode="settings" readOnly={!isOwner} />
      </Section>
    </PageContainer>
  );
}
