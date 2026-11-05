import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { TenantStatusBadge } from "@/components/platform/status-badge";
import { getPlatformTenant, getTenantTeam } from "@/lib/data/platform";
import { optionalServerEnv } from "@/lib/env.server";
import { publicEnv } from "@/lib/env";
import { tenantUrl } from "@/lib/tenant-host";
import { formatDate } from "@/lib/format-date";
import { formatPrice } from "@/lib/utils";
import { enterTenantAdmin, extendTrial, setTenantPlan, setTenantStatus } from "../actions";

export const metadata: Metadata = { title: "Academy" };

const PIANI = [
  { codice: "start", nome: "Start" },
  { codice: "pro", nome: "Pro" },
  { codice: "business", nome: "Business" },
];

export default async function PlatformTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getPlatformTenant(id);
  if (!t) notFound();
  const team = await getTenantTeam(id);
  const nexora = t.slug === publicEnv.NEXT_PUBLIC_TENANT_SLUG;
  const indirizzo = t.dominio_personalizzato
    ? `https://${t.dominio_personalizzato}`
    : nexora
      ? `https://${publicEnv.NEXT_PUBLIC_ROOT_DOMAIN}`
      : tenantUrl(t.slug, publicEnv.NEXT_PUBLIC_ROOT_DOMAIN, "");
  const test = /^(sk|rk)_test_/.test(optionalServerEnv("STRIPE_SECRET_KEY") ?? "");
  const stripeBase = `https://dashboard.stripe.com${test ? "/test" : ""}`;

  return (
    <div className="space-y-8">
      <Link
        href="/piattaforma"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Tutte le academy
      </Link>
      <PageHeader
        title={t.nome}
        description={indirizzo.replace("https://", "")}
        actions={
          <form action={enterTenantAdmin.bind(null, t.id, t.slug)}>
            <SubmitButton pendingText="Entro…">Entra nel pannello</SubmitButton>
          </form>
        }
      />

      <Card>
        <CardBody className="grid gap-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
          <Info label="Stato">
            <TenantStatusBadge stato={t.stato} />
            {t.stato === "prova" && t.prova_fine_il && (
              <span className="mt-1 block text-sm text-ink-muted">
                fino al {formatDate(t.prova_fine_il)}
              </span>
            )}
          </Info>
          <Info label="Piano">
            {t.piano ?? "—"}
            <span className="block text-sm text-ink-muted">
              {t.abbonamento_attivo ? "Abbonamento Stripe attivo" : "Nessun abbonamento"}
            </span>
          </Info>
          <Info label="Numeri">
            {t.studenti} studenti · {t.corsi} corsi
            <span className="block text-sm text-ink-muted">
              Vendite totali {formatPrice(t.vendite_totali_cents, "EUR")}
            </span>
          </Info>
          <Info label="Creata il">{formatDate(t.creato_il)}</Info>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-5 sm:p-8">
            <CardTitle>Gestione</CardTitle>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Prova gratuita</p>
              <div className="flex flex-wrap gap-2">
                {[7, 14, 30].map((g) => (
                  <form key={g} action={extendTrial.bind(null, t.id, g, t.prova_fine_il)}>
                    <SubmitButton variant="secondary" pendingText="…">
                      +{g} giorni
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </div>
            <form action={setTenantPlan.bind(null, t.id)} className="space-y-2">
              <label htmlFor="piano" className="block text-sm font-semibold">
                Piano (senza toccare Stripe)
              </label>
              <div className="flex gap-2">
                <select
                  id="piano"
                  name="piano"
                  defaultValue={t.piano_codice ?? "start"}
                  className="h-11 flex-1 rounded-md border border-line bg-surface px-3 text-sm"
                >
                  {PIANI.map((p) => (
                    <option key={p.codice} value={p.codice}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <SubmitButton variant="secondary" pendingText="…">
                  Cambia
                </SubmitButton>
              </div>
            </form>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Stato dell&apos;academy</p>
              <div className="flex flex-wrap gap-2">
                {t.stato !== "attivo" && (
                  <form action={setTenantStatus.bind(null, t.id, "attivo")}>
                    <SubmitButton variant="secondary" pendingText="…">
                      Attiva
                    </SubmitButton>
                  </form>
                )}
                {t.stato !== "sospeso" && !nexora && (
                  <form action={setTenantStatus.bind(null, t.id, "sospeso")}>
                    <SubmitButton variant="danger" pendingText="…">
                      Sospendi
                    </SubmitButton>
                  </form>
                )}
              </div>
              <p className="text-xs text-ink-muted">
                Sospesa = non visibile agli studenti. Se l&apos;academy ha un abbonamento Stripe, al
                prossimo rinnovo lo stato si riallinea a quello del pagamento.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-5 sm:p-8">
            <CardTitle>Team e collegamenti</CardTitle>
            <ul className="divide-y divide-line text-sm">
              {team.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{m.nome || m.email}</span>
                    <a
                      href={`mailto:${m.email}`}
                      className="block truncate text-nexora-blue hover:underline"
                    >
                      {m.email}
                    </a>
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    {m.ruolo === "admin" ? "Admin" : "Docente"}
                  </span>
                </li>
              ))}
              {team.length === 0 && <li className="py-2 text-ink-muted">Nessun amministratore.</li>}
            </ul>
            <ul className="space-y-2 text-sm">
              <Ext href={indirizzo}>Apri l&apos;academy</Ext>
              {t.stripe_customer_id && (
                <Ext href={`${stripeBase}/customers/${t.stripe_customer_id}`}>
                  Abbonamento su Stripe
                </Ext>
              )}
              {t.stripe_account_id && (
                <Ext href={`${stripeBase}/connect/accounts/${t.stripe_account_id}`}>
                  Conto Stripe del cliente {t.pagamenti_attivi ? "(incassa)" : "(da completare)"}
                </Ext>
              )}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-ink-muted">{label}</p>
      <div className="mt-1 font-semibold">{children}</div>
    </div>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center gap-2 font-semibold text-nexora-blue hover:underline"
      >
        {children} <ExternalLink aria-hidden className="size-4" />
      </a>
    </li>
  );
}
