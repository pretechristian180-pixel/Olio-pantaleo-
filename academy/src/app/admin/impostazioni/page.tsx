import { requireTenantAdmin } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { getCurrentTenant } from "@/lib/tenant";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { BrandForm } from "@/components/admin/brand-form";

export default async function SettingsPage() {
  await requireTenantAdmin();
  const tenant = (await getCurrentTenant())!;
  const indirizzo =
    tenant.dominioPersonalizzato ?? `${tenant.slug}.${publicEnv.NEXT_PUBLIC_ROOT_DOMAIN}`;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Impostazioni" title="La tua academy" />
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-3 sm:p-8">
          <Info label="Indirizzo" value={indirizzo} />
          <Info label="Piano" value={tenant.piano?.nome ?? "—"} />
          <Info
            label="Stato"
            value={
              tenant.stato === "prova" && tenant.provaFineIl
                ? `In prova fino al ${new Date(tenant.provaFineIl).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`
                : tenant.stato === "attivo"
                  ? "Attiva"
                  : tenant.stato === "insoluto"
                    ? "Pagamento da regolarizzare"
                    : "Sospesa"
            }
          />
        </CardBody>
      </Card>
      <Card>
        <CardBody className="sm:p-8">
          <CardTitle>Marchio</CardTitle>
          <p className="mt-1 mb-6 text-sm text-ink-muted">
            Logo e colori si applicano subito a tutte le pagine della tua academy.
          </p>
          <BrandForm
            initial={{
              nome: tenant.nome,
              logo_text: tenant.brand.logoText,
              logo_url: tenant.brand.logoUrl ?? "",
              tagline: tenant.brand.tagline ?? "",
              primary: tenant.brand.primary,
              dark: tenant.brand.dark,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-semibold break-all">{value}</p>
    </div>
  );
}
