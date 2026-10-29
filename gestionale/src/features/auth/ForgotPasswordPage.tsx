import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { AuthLayout, FormError, FormNotice } from "./AuthLayout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Controlla l'indirizzo email.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/imposta-password`,
    });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    setSent(true);
  }

  return (
    <AuthLayout
      title="Recupera la password"
      subtitle="Ti mandiamo un link per sceglierne una nuova."
      footer={
        <Link to="/accedi" className="font-semibold text-primary hover:underline">
          Torna all'accesso
        </Link>
      }
    >
      {sent ? (
        <FormNotice>
          Se esiste un account con <strong>{email.trim()}</strong>, riceverai a breve un'email con il link. Controlla anche
          la cartella spam.
        </FormNotice>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field label="Email" htmlFor="fp-email">
            <Input id="fp-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            <Mail aria-hidden />
            {busy ? "Invio in corso…" : "Inviami il link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
