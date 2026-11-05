import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";
import { getCurrentTenant } from "@/lib/tenant";
import { AuthShell, AuthTitle } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Crea il tuo account", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  if (await getSessionUser()) redirect(next);
  const tenant = await getCurrentTenant();
  return (
    <AuthShell>
      <AuthTitle
        title="Crea il tuo account"
        subtitle="Ti serve per guardare la lezione gratuita e, quando acquisti, per ritrovare i tuoi corsi."
      />
      <RegisterForm next={next} tenantSlug={tenant?.slug ?? ""} />
    </AuthShell>
  );
}
