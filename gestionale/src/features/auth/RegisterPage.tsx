import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { AuthLayout, FormError, FormNotice } from "./AuthLayout";

/** Chi si registra crea l'agenzia e ne diventa titolare (lo fa il database alla creazione dell'utente). */
export function RegisterPage() {
  const [form, setForm] = useState({ agency: "", firstName: "", lastName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (!form.agency.trim()) errs.agency = "Scrivi il nome dell'agenzia";
    if (!form.firstName.trim()) errs.firstName = "Scrivi il tuo nome";
    if (!form.lastName.trim()) errs.lastName = "Scrivi il tuo cognome";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = "Controlla l'indirizzo email";
    if (form.password.length < 8) errs.password = "Almeno 8 caratteri";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { agency_name: form.agency.trim(), nome: form.firstName.trim(), cognome: form.lastName.trim() },
      },
    });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    // Se la conferma email è attiva non c'è ancora una sessione: chiediamo di aprire la posta
    if (!data.session) setSentTo(form.email.trim());
  }

  if (sentTo)
    return (
      <AuthLayout title="Controlla la posta">
        <FormNotice>
          Ti abbiamo inviato un'email a <strong>{sentTo}</strong>. Apri il link che contiene per attivare l'account, poi
          torna qui ad accedere.
        </FormNotice>
        <Button asChild size="lg" variant="outline" className="mt-6 w-full">
          <Link to="/accedi">Vai all'accesso</Link>
        </Button>
      </AuthLayout>
    );

  const field = (k: keyof typeof form, label: string, props: React.ComponentProps<"input"> = {}) => (
    <Field label={label} htmlFor={`rg-${k}`}>
      <Input
        id={`rg-${k}`}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={!!errors[k]}
        className={cn(errors[k] && "border-destructive")}
        {...props}
      />
      {errors[k] && <p className="mt-1.5 text-sm font-medium text-destructive">{errors[k]}</p>}
    </Field>
  );

  return (
    <AuthLayout
      title="Registra la tua agenzia"
      subtitle="Bastano un minuto e questi pochi dati. Potrai invitare i tuoi agenti dopo."
      footer={
        <>
          Hai già un account?{" "}
          <Link to="/accedi" className="font-semibold text-primary-strong hover:underline">
            Accedi
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {field("agency", "Nome dell'agenzia", { placeholder: "Es. Immobiliare Levante", autoComplete: "organization" })}
        <div className="grid gap-5 sm:grid-cols-2">
          {field("firstName", "Nome", { autoComplete: "given-name" })}
          {field("lastName", "Cognome", { autoComplete: "family-name" })}
        </div>
        {field("email", "Email", { type: "email", inputMode: "email", autoComplete: "email" })}
        {field("password", "Password", { type: "password", autoComplete: "new-password" })}
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <Check aria-hidden />
          {busy ? "Creazione in corso…" : "Crea l'agenzia"}
        </Button>
      </form>
    </AuthLayout>
  );
}
