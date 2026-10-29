import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { authLinkType, supabase } from "@/lib/supabase";
import { acceptInvitation } from "@/services/api";
import { AuthLayout, FormError } from "./AuthLayout";
import { useAuth } from "./AuthProvider";

/** Dopo il link di invito (nuovo agente) o di recupero password. */
export function SetPasswordPage() {
  const { session, loading, passwordSet, refresh } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const invite = authLinkType === "invite";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("La password deve avere almeno 8 caratteri.");
    if (pw !== pw2) return setError("Le due password non sono uguali.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setBusy(false);
      return setError(friendlyError(error));
    }
    if (invite) await acceptInvitation();
    passwordSet();
    await refresh();
    navigate("/", { replace: true });
  }

  if (!loading && !session)
    return (
      <AuthLayout title="Link non valido" subtitle="Il link è scaduto o è già stato usato.">
        <Button asChild size="lg" className="w-full">
          <Link to="/password-dimenticata">Chiedi un nuovo link</Link>
        </Button>
      </AuthLayout>
    );

  return (
    <AuthLayout
      title={invite ? "Benvenuto in agenzia" : "Scegli una nuova password"}
      subtitle={invite ? "Scegli la password che userai per entrare." : "Poi entrerai subito nell'app."}
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Nuova password" htmlFor="sp-1" hint="Almeno 8 caratteri">
          <Input id="sp-1" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="Ripeti la password" htmlFor="sp-2">
          <Input id="sp-2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy || loading}>
          <Check aria-hidden />
          {busy ? "Salvataggio…" : "Salva la password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
