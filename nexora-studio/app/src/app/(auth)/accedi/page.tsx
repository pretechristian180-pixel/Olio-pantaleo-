import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { safeNext } from "@/lib/safe-redirect";

import { SignInForm } from "./form";

export const metadata: Metadata = { title: "Accedi" };

const notices: Record<string, string> = {
  confermato: "Email confermata. Ora puoi accedere.",
  "link-scaduto": "Il link è scaduto o è già stato usato. Accedi oppure richiedine uno nuovo.",
};

export default async function AccediPage(props: PageProps<"/accedi">) {
  const { next, avviso } = await props.searchParams;
  const nextPath = safeNext(typeof next === "string" ? next : null);
  const notice = typeof avviso === "string" ? notices[avviso] : undefined;
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Bentornato</h1>
        <p className="text-muted-foreground">Accedi per vedere i video della settimana.</p>
      </div>
      {notice && (
        <Alert variant="info">
          <AlertDescription className="text-foreground">{notice}</AlertDescription>
        </Alert>
      )}
      <SignInForm next={nextPath} />
      <p className="text-center text-sm text-muted-foreground">
        Non hai un account?{" "}
        <Link
          href={
            nextPath !== "/inizio"
              ? `/registrati?next=${encodeURIComponent(nextPath)}`
              : "/registrati"
          }
          className="font-semibold text-primary-text underline-offset-4 hover:underline"
        >
          Prova gratis
        </Link>
      </p>
    </div>
  );
}
