import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/shared/States";
import { mostraErrore } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "./AuthLayout";

const schema = z.object({ email: z.string().trim().min(1, "Inserisci la tua email").pipe(z.email("Email non valida")) });
type Valori = z.infer<typeof schema>;

export default function RecuperaPasswordPage() {
  const [inviata, setInviata] = useState(false);
  const form = useForm<Valori>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.auth.resetPasswordForEmail(v.email, { redirectTo: `${window.location.origin}/imposta-password` });
    if (error) return mostraErrore(error, "Invio non riuscito. Riprova.");
    setInviata(true);
  });

  return (
    <AuthLayout title="Password dimenticata" subtitle="Ti mandiamo un link per sceglierne una nuova.">
      {inviata ? (
        <div className="flex gap-4 rounded-lg border bg-accent-soft p-4">
          <MailCheck className="size-6 shrink-0 text-accent" aria-hidden />
          <p className="text-[15px]">Se l'email è registrata riceverai a breve il link. Controlla anche lo spam.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Field label="Email" htmlFor="rp-email" error={err.email?.message}>
            <Input id="rp-email" type="email" inputMode="email" autoComplete="email" autoFocus aria-invalid={!!err.email} {...form.register("email")} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            Invia link
          </Button>
        </form>
      )}
      <p className="mt-8 text-center text-[15px]">
        <Link to="/accedi" className="font-semibold text-accent hover:underline">
          Torna all'accesso
        </Link>
      </p>
    </AuthLayout>
  );
}
