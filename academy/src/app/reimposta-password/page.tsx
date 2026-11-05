import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { AuthShell, AuthTitle } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Nuova password", robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ dopo?: string }>;
}) {
  // Si arriva qui dal link email, che apre già la sessione.
  await requireUser("/reimposta-password");
  const dopo = safeNext((await searchParams).dopo);
  return (
    <AuthShell>
      <AuthTitle title="Scegli una nuova password" />
      <ResetPasswordForm next={dopo} />
    </AuthShell>
  );
}
