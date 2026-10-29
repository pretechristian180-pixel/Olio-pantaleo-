import { useState } from "react";
import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/app";
import { Field, Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { AuthLayout, FormError } from "./AuthLayout";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Scrivi email e password.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(friendlyError(error));
  }

  return (
    <AuthLayout
      title="Accedi"
      subtitle={`Bentornato su ${APP_NAME}. Entra con la tua email.`}
      footer={
        <>
          Nuova agenzia?{" "}
          <Link to="/registrati" className="font-semibold text-primary-strong hover:underline">
            Registrati
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Email" htmlFor="li-email">
          <Input id="li-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="li-pw">
          <Input id="li-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <LogIn aria-hidden />
          {busy ? "Accesso in corso…" : "Accedi"}
        </Button>
        <p className="text-center">
          <Link to="/password-dimenticata" className="inline-flex h-11 items-center px-2 font-medium text-primary-strong hover:underline">
            Ho dimenticato la password
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
