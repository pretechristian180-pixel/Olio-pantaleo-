import type { Metadata } from "next";
import Link from "next/link";

import { NexoraLogo } from "@/components/brand/logo";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/lib/actions/team";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/workspace";

export const metadata: Metadata = { title: "Invito", robots: { index: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InvitoPage(props: PageProps<"/invito/[token]">) {
  const { token } = await props.params;
  const { errore } = await props.searchParams;
  const supabase = await createClient();
  const user = await getUser();

  const { data } = UUID_RE.test(token)
    ? await supabase.rpc("get_invitation", { p_token: token })
    : { data: null };
  const invitation = data?.[0];
  const next = encodeURIComponent(`/invito/${token}`);
  const wrongUser =
    user && invitation && user.email.toLowerCase() !== invitation.email.toLowerCase();

  let body: React.ReactNode;
  if (!invitation || invitation.status !== "open") {
    const reason =
      invitation?.status === "accepted"
        ? "Questo invito è già stato usato."
        : invitation?.status === "expired"
          ? "Questo invito è scaduto."
          : "Questo invito non è valido o è stato annullato.";
    body = (
      <>
        <h1 className="text-2xl font-semibold">Invito non disponibile</h1>
        <p className="text-muted-foreground">
          {reason} Chiedi al titolare di mandartene uno nuovo.
        </p>
        <Button variant="outline" size="lg" asChild>
          <Link href={user ? "/inizio" : "/accedi"}>{user ? "Vai alla Home" : "Accedi"}</Link>
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-2xl font-semibold text-balance">
          Entra nel team di {invitation.workspace_name}
        </h1>
        <p className="text-muted-foreground">
          Sei stato invitato come {invitation.role === "owner" ? "titolare" : "collaboratore"} con
          l&apos;email <span className="font-medium text-foreground">{invitation.email}</span>.
        </p>
        {errore && (
          <Alert variant="destructive">
            <AlertDescription className="text-foreground">
              Non siamo riusciti ad accettare l&apos;invito. Riprova.
            </AlertDescription>
          </Alert>
        )}
        {!user ? (
          <div className="grid gap-3">
            <Button variant="brand" size="lg" asChild>
              <Link href={`/registrati?next=${next}`}>Crea l&apos;account</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href={`/accedi?next=${next}`}>Ho già un account</Link>
            </Button>
          </div>
        ) : wrongUser ? (
          <Alert variant="warning">
            <AlertDescription className="text-foreground">
              Hai fatto l&apos;accesso come {user.email}. Per accettare, entra con{" "}
              {invitation.email}.
            </AlertDescription>
          </Alert>
        ) : (
          <form action={acceptInvitation}>
            <input type="hidden" name="token" value={token} />
            <SubmitButton
              variant="brand"
              size="lg"
              className="w-full"
              pendingLabel="Entro nel team…"
            >
              Accetta l&apos;invito
            </SubmitButton>
          </form>
        )}
      </>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-aurora" aria-hidden />
      <header className="relative mx-auto flex h-16 w-full max-w-md items-center px-5">
        <NexoraLogo />
      </header>
      <main className="relative mx-auto grid w-full max-w-md content-start gap-5 px-5 pt-10 pb-12">
        {body}
      </main>
    </div>
  );
}
