import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";
import { AuthShell, AuthTitle } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Accedi", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string; errore?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getSessionUser()) redirect(next);
  return (
    <AuthShell>
      <AuthTitle title="Accedi ai tuoi corsi" subtitle="Usa l'email con cui hai acquistato." />
      <LoginForm next={next} linkError={sp.errore === "link"} />
    </AuthShell>
  );
}
