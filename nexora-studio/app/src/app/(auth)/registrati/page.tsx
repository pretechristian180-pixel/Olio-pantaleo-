import type { Metadata } from "next";
import Link from "next/link";

import { safeNext } from "@/lib/safe-redirect";

import { SignUpForm } from "./form";

export const metadata: Metadata = { title: "Crea l'account" };

export default async function RegistratiPage(props: PageProps<"/registrati">) {
  const { next } = await props.searchParams;
  const nextPath = typeof next === "string" ? safeNext(next, "/onboarding") : undefined;
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Prova gratis 3 video</h1>
        <p className="text-muted-foreground">
          Crea l&apos;account in un minuto. Non serve la carta di credito.
        </p>
      </div>
      <SignUpForm next={nextPath} />
      <p className="text-center text-sm text-muted-foreground">
        Hai già un account?{" "}
        <Link
          href={nextPath ? `/accedi?next=${encodeURIComponent(nextPath)}` : "/accedi"}
          className="font-semibold text-primary-text underline-offset-4 hover:underline"
        >
          Accedi
        </Link>
      </p>
    </div>
  );
}
