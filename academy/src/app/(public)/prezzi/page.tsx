import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPlans } from "@/lib/data/plans";
import { publicEnv } from "@/lib/env";
import { isPlatformHost } from "@/lib/tenant";
import { PageHeader } from "@/components/layout/page-header";
import { PlanCard } from "@/components/platform/plan-card";

export const metadata: Metadata = {
  title: "Prezzi: crea la tua academy",
  description:
    "La tua piattaforma di videocorsi con il tuo marchio. Vendi con il tuo Stripe, zero commissioni. Prova gratis 14 giorni.",
  alternates: { canonical: "/prezzi" },
};

export default async function PricingPage() {
  if (!(await isPlatformHost())) redirect(`https://${publicEnv.NEXT_PUBLIC_ROOT_DOMAIN}/prezzi`);
  const plans = await getPlans();
  return (
    <div className="mx-auto max-w-310 px-4 py-14 sm:px-6 sm:py-20">
      <PageHeader
        eyebrow="La tua academy"
        title="I tuoi corsi, il tuo marchio, i tuoi incassi"
        description="Carichi i video, scegli logo e colori, vendi con il tuo account Stripe. Noi non prendiamo commissioni: paghi solo l'abbonamento. 14 giorni di prova, senza carta."
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.codice} plan={p} highlight={p.codice === "pro"} />
        ))}
      </div>
      <p className="mt-8 text-sm text-ink-muted">
        «Studenti attivi» sono quelli che guardano almeno una lezione nel mese: chi ha comprato e
        non entra non conta. Su Stripe paghi solo le sue commissioni sui pagamenti.
      </p>
    </div>
  );
}
