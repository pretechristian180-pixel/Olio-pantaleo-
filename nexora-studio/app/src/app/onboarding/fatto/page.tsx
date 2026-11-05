import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, FileText, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { firstName, getSessionContext } from "@/lib/workspace";

import { DoneMark } from "../steps";

export const metadata: Metadata = { title: "Tutto pronto" };

export default async function OnboardingDonePage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/accedi");
  if (!ctx.active?.workspace.onboarding_completed_at) redirect("/onboarding");

  const next = [
    { icon: FileText, text: "Prepariamo gli script della prima settimana." },
    { icon: Mail, text: "Ti avvisiamo via email appena sono pronti." },
    { icon: CalendarCheck, text: "Giri, carichi e al resto pensiamo noi." },
  ];

  return (
    <div className="grid justify-items-center gap-8 pt-6 text-center">
      <DoneMark />
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Tutto pronto, {firstName(ctx)}!</h1>
        <p className="text-muted-foreground">
          {ctx.active.workspace.name} è configurata. Ecco cosa succede adesso.
        </p>
      </div>
      <ol className="grid w-full max-w-md gap-3 text-left">
        {next.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary-text">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="text-sm">{text}</span>
          </li>
        ))}
      </ol>
      <Button variant="brand" size="lg" className="w-full max-w-md" asChild>
        <Link href="/inizio">Vai alla Home</Link>
      </Button>
    </div>
  );
}
