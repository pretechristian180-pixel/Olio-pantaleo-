import { requireTenantAdmin } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { getCurrentTenant, isNexoraTenant } from "@/lib/tenant";
import { getPlans } from "@/lib/data/plans";
import { isStripeConfigured } from "@/lib/stripe";
import { syncConnectAccount } from "@/lib/stripe-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentsCard, SubscriptionCard } from "@/components/admin/billing-section";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { BrandForm } from "@/components/admin/brand-form";

/** Dati di fatturazione (non leggibili dal browser): solo con chiave segreta configurata. */
async function getBilling(tenantId: string) {
  if (!isStripeConfigured()) return null;
  const { data } = await createAdminClient()
    .from("tenants")
    .select("stripe_subscription_id, stripe_account_id, stripe_pagamenti_attivi")
    .eq("id", tenantId)
    .single();
  if (!data) return null;
  // Conto collegato ma non ancora attivo (onboarding in corso o appena concluso): rileggiamo lo
  // stato da Stripe, così non dipendiamo dall'arrivo del webhook.
  if (data.stripe_account_id && !data.stripe_pagamenti_attivi) {
    data.stripe_pagamenti_attivi = await syncConnectAccount(data.stripe_account_id).catch(
      () => false,
    );
  }
  return data;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ abbonamento?: string; stripe?: string }>;
}) {
  await requireTenantAdmin();
  const tenant = (await getCurrentTenant())!;
  const sp = await searchParams;
  const [nexora, plans, billing] = await Promise.all([
    isNexoraTenant(),
    getPlans(),
    getBilling(tenant.id),
  ]);
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
      {!nexora && billing && (
        <>
          <SubscriptionCard
            tenant={tenant}
            plans={plans}
            hasSubscription={Boolean(billing.stripe_subscription_id)}
            esito={sp.abbonamento}
          />
          <PaymentsCard
            connected={Boolean(billing.stripe_account_id)}
            attivi={billing.stripe_pagamenti_attivi}
            esito={sp.stripe}
          />
        </>
      )}
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
