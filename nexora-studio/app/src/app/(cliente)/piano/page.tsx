import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CheckCircle2, Crown, Sparkles, TriangleAlert } from "lucide-react";

import { AddBrandForm, ChoosePlanForm, PortalForm } from "@/components/billing/billing-forms";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { UsageMeter } from "@/components/layout/usage-meter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BLOCK_MESSAGES, dateFmt, euro, getPlanUsage, type Plan } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Piano e fatturazione" };

const INTERVAL_LABEL = { month: "mensile", year: "annuale" } as const;

function planFeatures(p: Plan) {
  return [
    `${p.videos_per_month} video montati al mese${p.brands_max > 1 ? " per brand" : ""}`,
    `${p.social_accounts_max} social collegati${p.brands_max > 1 ? " per brand" : ""}`,
    p.broll_credits_month > 0
      ? `${p.broll_credits_month} clip b-roll al mese${p.brands_max > 1 ? " per brand" : ""}`
      : "Senza b-roll",
    p.brands_max > 1 ? `Fino a ${p.brands_max} brand con un solo abbonamento` : "1 brand",
    "Script settimanali, sottotitoli, musica e pubblicazione",
  ];
}

export default async function PianoPage(props: PageProps<"/piano">) {
  const sp = await props.searchParams;
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;
  const supabase = await createClient();

  const payerId = ws.billing_workspace_id ?? ws.id;
  const payerMembership = ctx.memberships.find((m) => m.workspace.id === payerId);
  const payer = payerMembership?.workspace ?? null;
  const canManage = payerMembership?.role === "owner";
  const interval: "month" | "year" = sp.periodo === "annuale" ? "year" : "month";

  const [usage, { data: plans }, { data: brands }] = await Promise.all([
    getPlanUsage(ws),
    supabase.from("plans").select("*").eq("active", true).order("sort_order"),
    canManage
      ? supabase
          .from("workspaces")
          .select("id, name")
          .eq("billing_workspace_id", payerId)
          .order("created_at")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const block = usage.blocked ? BLOCK_MESSAGES[usage.blocked] : null;
  const hasSubscription =
    Boolean(payer?.stripe_subscription_id) && ws.subscription_status !== "canceled";
  const brandCount = 1 + (brands?.length ?? 0);

  return (
    <PageContainer>
      <PageHeader
        title="Piano e fatturazione"
        description="Il tuo piano, quanto hai usato in questo periodo e le fatture."
      />

      {sp.attivato && (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <AlertTitle>Abbonamento attivo</AlertTitle>
          <AlertDescription>
            Grazie! Il piano è attivo: puoi caricare i prossimi video.
          </AlertDescription>
        </Alert>
      )}
      {sp.cambiato && (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <AlertTitle>Piano cambiato</AlertTitle>
          <AlertDescription>
            Fatto: ora sei sul piano {usage.plan?.name}. I nuovi limiti valgono da subito.
          </AlertDescription>
        </Alert>
      )}
      {block && !sp.attivato && (
        <Alert
          variant={
            usage.blocked === "limit_reached" || usage.blocked === "trial_over"
              ? "warning"
              : "destructive"
          }
        >
          <TriangleAlert aria-hidden />
          <AlertTitle>{block.title}</AlertTitle>
          <AlertDescription>{block.text}</AlertDescription>
        </Alert>
      )}
      {ws.cancel_at_period_end && ws.period_end && ws.subscription_status === "active" && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertTitle>Abbonamento disdetto</AlertTitle>
          <AlertDescription>
            Resta attivo fino al {dateFmt.format(new Date(ws.period_end))}. Puoi riattivarlo da
            &quot;Pagamento e fatture&quot;.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {usage.isTrial ? "Prova gratuita" : `Piano ${usage.plan?.name ?? ""}`}
              {payer?.founding_member && (
                <Badge variant="info" className="gap-1">
                  <Crown aria-hidden /> Founding member
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {usage.isTrial
                ? "3 video montati gratis, senza carta di credito."
                : ws.period_end
                  ? `Abbonamento ${INTERVAL_LABEL[ws.billing_interval ?? "month"]} · ${ws.cancel_at_period_end ? "termina" : "si rinnova"} il ${dateFmt.format(new Date(ws.period_end))}`
                  : `Abbonamento ${INTERVAL_LABEL[ws.billing_interval ?? "month"]}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <UsageMeter
              label={
                usage.isTrial
                  ? "Video della prova"
                  : `Video del periodo${brandCount > 1 || ws.billing_workspace_id ? ` · ${ws.name}` : ""}`
              }
              used={usage.videosUsed}
              total={usage.videosLimit}
              hint={
                usage.videosUsed >= usage.videosLimit
                  ? "Hai usato tutti i video disponibili."
                  : `Ne restano ${usage.videosLimit - usage.videosUsed}.`
              }
            />
            {!usage.isTrial && usage.brollLimit > 0 && (
              <UsageMeter
                label="Clip b-roll"
                used={usage.brollUsed}
                total={usage.brollLimit}
                hint="Finite le clip, i video escono comunque, senza b-roll."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagamento e fatture</CardTitle>
            <CardDescription>
              {ws.billing_workspace_id
                ? `L'abbonamento è gestito da ${payer?.name ?? "l'azienda principale"}.`
                : "Carta, fatture e disdetta, sul portale sicuro di Stripe."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage && payer?.stripe_customer_id ? (
              <PortalForm workspaceId={ws.id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {canManage
                  ? "Le fatture compaiono qui dopo il primo pagamento."
                  : "Solo il titolare gestisce i pagamenti."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <section className="grid gap-4" aria-labelledby="piani">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="piani" className="text-lg font-semibold">
                {hasSubscription ? "Cambia piano" : "Scegli il piano"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Prezzi IVA esclusa. Con l&apos;annuale paghi 10 mesi invece di 12.
                {payer?.founding_member && " Il tuo prezzo da founding member resta bloccato."}
              </p>
            </div>
            <div
              className="inline-flex rounded-xl border bg-card p-1 text-sm"
              role="group"
              aria-label="Periodicità"
            >
              {(["month", "year"] as const).map((i) => (
                <Link
                  key={i}
                  href={i === "year" ? "/piano?periodo=annuale" : "/piano"}
                  aria-current={interval === i ? "true" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-medium transition-colors",
                    interval === i
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {i === "month" ? "Mensile" : "Annuale −2 mesi"}
                </Link>
              ))}
            </div>
          </div>

          <ul className="grid gap-4 md:grid-cols-3">
            {(plans ?? []).map((p) => {
              const current = !usage.isTrial && ws.plan_id === p.id && hasSubscription;
              const sameInterval = (ws.billing_interval ?? "month") === interval;
              const monthly =
                interval === "year" ? Math.round(p.price_yearly_cents / 12) : p.price_monthly_cents;
              const popular = p.id === "pro";
              return (
                <li
                  key={p.id}
                  className={cn(
                    "relative grid content-start gap-4 rounded-2xl border bg-card p-5",
                    popular && "border-nx-blue-500/60 shadow-glow",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                    {current ? (
                      <Badge variant="success">Il tuo piano</Badge>
                    ) : popular ? (
                      <Badge variant="info" className="gap-1">
                        <Sparkles aria-hidden /> Il più scelto
                      </Badge>
                    ) : null}
                  </div>
                  <p>
                    <span className="font-display text-3xl font-semibold">{euro(monthly)}</span>
                    <span className="text-sm text-muted-foreground"> /mese</span>
                    {interval === "year" && (
                      <span className="block text-xs text-muted-foreground">
                        {euro(p.price_yearly_cents)} all&apos;anno
                      </span>
                    )}
                  </p>
                  <ul className="grid gap-2 text-sm">
                    {planFeatures(p).map((f) => (
                      <li key={f} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {current && sameInterval ? (
                    <p className="text-center text-sm text-muted-foreground">Piano attuale</p>
                  ) : (
                    <ChoosePlanForm
                      workspaceId={ws.id}
                      planId={p.id}
                      interval={interval}
                      variant={popular ? "brand" : "outline"}
                      label={
                        current
                          ? `Passa all'${INTERVAL_LABEL[interval]}`
                          : hasSubscription
                            ? `Passa a ${p.name}`
                            : `Scegli ${p.name}`
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {hasSubscription && (
            <p className="text-xs text-muted-foreground">
              Cambiando piano paghi o ricevi solo la differenza per i giorni che restano nel
              periodo.
            </p>
          )}
        </section>
      )}

      {canManage && usage.plan && usage.plan.brands_max > 1 && hasSubscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary-text" aria-hidden /> I tuoi brand
            </CardTitle>
            <CardDescription>
              Il piano {usage.plan.name} copre fino a {usage.plan.brands_max} brand, ciascuno con i
              suoi {usage.plan.videos_per_month} video al mese e {usage.plan.social_accounts_max}{" "}
              social.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="grid gap-2">
              <li className="flex items-center justify-between rounded-lg border bg-background/40 p-3 text-sm">
                <span className="font-medium">{payer?.name}</span>
                <Badge variant="secondary">Principale</Badge>
              </li>
              {(brands ?? []).map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border bg-background/40 p-3 text-sm"
                >
                  <span className="font-medium">{b.name}</span>
                  <Badge variant="secondary">Incluso</Badge>
                </li>
              ))}
            </ul>
            {brandCount < usage.plan.brands_max ? (
              <AddBrandForm workspaceId={ws.id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Hai raggiunto il numero di brand del piano.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Passi da un brand all&apos;altro dal menu con il nome dell&apos;azienda.
            </p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
