import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPlans } from "@/lib/data/plans";
import { publicEnv } from "@/lib/env";
import { isPlatformHost } from "@/lib/tenant";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { CreateAcademyForm } from "@/components/platform/create-academy-form";

export const metadata: Metadata = {
  title: "Crea la tua academy",
  description:
    "La tua piattaforma di videocorsi con il tuo marchio, pronta in un minuto. 14 giorni gratis.",
  alternates: { canonical: "/crea-academy" },
};

type Props = { searchParams: Promise<{ piano?: string }> };

export default async function CreateAcademyPage({ searchParams }: Props) {
  if (!(await isPlatformHost()))
    redirect(`https://${publicEnv.NEXT_PUBLIC_ROOT_DOMAIN}/crea-academy`);
  const { piano } = await searchParams;
  const [user, plans] = await Promise.all([getSessionUser(), getPlans()]);
  const pianoIniziale = plans.some((p) => p.codice === piano) ? piano! : "pro";
  const next = `/crea-academy?piano=${pianoIniziale}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <PageHeader
        eyebrow="La tua academy"
        title="Crea la tua academy in un minuto"
        description="Scegli nome e indirizzo: poi carichi i video, imposti logo e colori e colleghi Stripe per vendere."
      />
      <Card className="mt-10">
        <CardBody className="sm:p-8">
          {user ? (
            <CreateAcademyForm
              rootDomain={publicEnv.NEXT_PUBLIC_ROOT_DOMAIN}
              pianoIniziale={pianoIniziale}
              piani={plans.map((p) => ({
                codice: p.codice,
                nome: p.nome,
                prezzo: formatPrice(p.prezzo_mese_cents),
              }))}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-[15px]">
                Per prima cosa crea il tuo account personale: con lo stesso account gestirai la tua
                academy.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={`/registrati?next=${encodeURIComponent(next)}`}>
                    Crea il tuo account
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href={`/accedi?next=${encodeURIComponent(next)}`}>Ho già un account</Link>
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      <p className="mt-6 text-sm text-ink-muted">
        Vuoi vedere i piani prima?{" "}
        <Link
          href="/prezzi"
          className="font-semibold text-nexora-blue underline underline-offset-2"
        >
          Confronta i prezzi
        </Link>
      </p>
    </div>
  );
}
