import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PageLoader, Spinner } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "./AuthLayout";

const schema = z.object({
  email: z.string().trim().min(1, "Inserisci la tua email").pipe(z.email("Email non valida")),
  password: z.string().min(1, "Inserisci la password"),
});
type Valori = z.infer<typeof schema>;

/** Solo percorsi interni, per evitare redirect verso siti esterni. */
const destinazioneSicura = (da: string | null) => (da && da.startsWith("/") && !da.startsWith("//") ? da : "/");

export default function AccediPage() {
  const { session, caricamento, ricarica } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const da = destinazioneSicura(params.get("da"));
  const form = useForm<Valori>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const err = form.formState.errors;

  if (caricamento) return <PageLoader />;
  if (session) return <Navigate to={da} replace />;

  const onSubmit = form.handleSubmit(async (v) => {
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
    if (error) return mostraErrore(error, "Accesso non riuscito. Riprova.");
    await ricarica();
    navigate(da, { replace: true });
  });

  return (
    <AuthLayout title="Bentornato" subtitle="Accedi per vedere cosa c'è da fare oggi.">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label="Email" htmlFor="ac-email" error={err.email?.message}>
          <Input id="ac-email" type="email" inputMode="email" autoComplete="email" autoFocus aria-invalid={!!err.email} {...form.register("email")} />
        </Field>
        <Field label="Password" htmlFor="ac-pwd" error={err.password?.message}>
          <Input id="ac-pwd" type="password" autoComplete="current-password" aria-invalid={!!err.password} {...form.register("password")} />
        </Field>
        <div className="-mt-2 text-right">
          <Link to="/recupera-password" className="text-[15px] font-medium text-accent hover:underline">
            Password dimenticata?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          Accedi
        </Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-muted-foreground">
        Nuovo su Sorpasso?{" "}
        <Link to="/registrati" className="font-semibold text-accent hover:underline">
          Crea la tua concessionaria
        </Link>
      </p>
    </AuthLayout>
  );
}
