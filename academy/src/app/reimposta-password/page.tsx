import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { AuthShell, AuthTitle } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Nuova password", robots: { index: false } };

export default async function ResetPasswordPage() {
  // Si arriva qui dal link email, che apre già la sessione.
  await requireUser("/reimposta-password");
  return (
    <AuthShell>
      <AuthTitle title="Scegli una nuova password" />
      <ResetPasswordForm />
    </AuthShell>
  );
}
