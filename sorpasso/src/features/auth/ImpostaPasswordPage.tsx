import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PageLoader, Spinner } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "./AuthLayout";

const schema = z
  .object({ password: z.string().min(8, "Almeno 8 caratteri"), conferma: z.string() })
  .refine((v) => v.password === v.conferma, { path: ["conferma"], message: "Le password non coincidono" });
type Valori = z.infer<typeof schema>;

/** Arrivo da link email: recupero password o invito di un collega. */
export default function ImpostaPasswordPage({ invito = false }: { invito?: boolean }) {
  const { session, caricamento, ricarica } = useAuth();
  const navigate = useNavigate();
  // Il token nel link viene scambiato in modo asincrono: diamo qualche istante prima di dire "link scaduto".
  const [attesa, setAttesa] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAttesa(false), 2500);
    return () => clearTimeout(t);
  }, []);
  const form = useForm<Valori>({ resolver: zodResolver(schema), defaultValues: { password: "", conferma: "" } });
  const err = form.formState.errors;

  const titolo = invito ? "Benvenuto nel team" : "Scegli una nuova password";
  const sottotitolo = invito
    ? "Il titolare ti ha invitato su Sorpasso. Scegli la password con cui accederai."
    : "Usa almeno 8 caratteri, meglio se con numeri e lettere.";

  if (caricamento || (!session && attesa)) return <PageLoader />;

  if (!session) {
    return (
      <AuthLayout title="Link scaduto o non valido" subtitle="Il link è già stato usato oppure è scaduto.">
        <Button asChild size="lg" className="w-full">
          <Link to={invito ? "/accedi" : "/recupera-password"}>{invito ? "Vai all'accesso" : "Richiedi un nuovo link"}</Link>
        </Button>
        {invito && <p className="mt-4 text-[15px] text-muted-foreground">Chiedi al titolare di inviarti un nuovo invito.</p>}
      </AuthLayout>
    );
  }

  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) return mostraErrore(error, "Non sono riuscito a salvare la password.");
    await ricarica();
    toast.success(invito ? "Benvenuto in Sorpasso!" : "Password aggiornata");
    navigate("/", { replace: true });
  });

  return (
    <AuthLayout title={titolo} subtitle={sottotitolo}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <p className="text-[15px] text-muted-foreground">
          Account: <strong className="text-foreground">{session.user.email}</strong>
        </p>
        <Field label="Nuova password" htmlFor="ip-pwd" error={err.password?.message}>
          <Input id="ip-pwd" type="password" autoComplete="new-password" autoFocus aria-invalid={!!err.password} {...form.register("password")} />
        </Field>
        <Field label="Ripeti password" htmlFor="ip-conf" error={err.conferma?.message}>
          <Input id="ip-conf" type="password" autoComplete="new-password" aria-invalid={!!err.conferma} {...form.register("conferma")} />
        </Field>
        <Button type="submit" size="lg" variant="accent" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {invito ? "Entra in Sorpasso" : "Salva password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
