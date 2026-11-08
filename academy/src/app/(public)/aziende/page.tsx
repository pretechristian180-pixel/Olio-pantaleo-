import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Per le aziende",
  description:
    "Accessi multipli ai corsi Christian Prete Academy per il tuo team, con report sull'avanzamento.",
  alternates: { canonical: "/aziende" },
};

const punti = [
  "Accessi per tutto il team, gestiti da un unico referente",
  "Report sull'avanzamento di ogni collaboratore",
  "Attestato Christian Prete Academy per chi completa il corso",
  "Fattura unica all'azienda",
];

export default function BusinessPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <PageHeader
        eyebrow="Per le aziende"
        title="Hai un team da formare?"
        description="Porta i corsi di Christian Prete in azienda: tutti imparano lo stesso metodo e tu vedi chi sta andando avanti."
      />
      <ul className="mt-10 flex flex-col gap-3">
        {punti.map((p) => (
          <li key={p} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
            <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-nexora-blue-bright" />
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-10">
        {publicEnv.NEXT_PUBLIC_CONTACT_EMAIL ? (
          <Button asChild size="lg">
            <Link
              href={`mailto:${publicEnv.NEXT_PUBLIC_CONTACT_EMAIL}?subject=Offerta%20aziende%20Christian%20Prete%20Academy`}
            >
              Richiedi l&apos;offerta aziende
            </Link>
          </Button>
        ) : (
          <p className="text-ink-muted">Il modulo di contatto arriva a breve.</p>
        )}
      </div>
    </div>
  );
}
