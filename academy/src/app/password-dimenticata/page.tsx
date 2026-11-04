import type { Metadata } from "next";
import { AuthShell, AuthTitle } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Password dimenticata", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <AuthTitle
        title="Password dimenticata"
        subtitle="Scrivi la tua email: ti mandiamo un link per sceglierne una nuova."
      />
      <ForgotPasswordForm />
    </AuthShell>
  );
}
