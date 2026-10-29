import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PageLoader, Spinner } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "./AuthLayout";
import { campiAzienda, creaOrganizzazione } from "./schemaAzienda";

const schema = z
  .object({
    ...campiAzienda,
    email: z.string().trim().min(1, "Inserisci la tua email").pipe(z.email("Email non valida")),
    password: z.string().min(8, "Almeno 8 caratteri"),
    conferma: z.string(),
    termini: z.boolean().refine((v) => v, "Devi accettare i termini per continuare"),
  })
  .refine((v) => v.password === v.conferma, { path: ["conferma"], message: "Le password non coincidono" });
type Valori = z.infer<typeof schema>;

export default function RegistratiPage() {
  const { session, caricamento, ricarica } = useAuth();
  const navigate = useNavigate();
  const [emailInviata, setEmailInviata] = useState<string | null>(null);
  const form = useForm<Valori>({
    resolver: zodResolver(schema),
    defaultValues: { azienda: "", piva: "", nome: "", telefono: "", email: "", password: "", conferma: "", termini: false },
  });
  const err = form.formState.errors;

  if (caricamento) return <PageLoader />;
  if (session && !emailInviata && !form.formState.isSubmitting) return <Navigate to="/" replace />;

  const onSubmit = form.handleSubmit(async (v) => {
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { nome: v.nome, azienda: v.azienda, piva: v.piva, telefono: v.telefono },
        emailRedirectTo: `${window.location.origin}/benvenuto`,
      },
    });
    if (error) return mostraErrore(error, "Registrazione non riuscita. Riprova.");
    if (!data.session) {
      setEmailInviata(v.email);
      return;
    }
    try {
      await creaOrganizzazione(v);
      await ricarica();
      navigate("/", { replace: true });
    } catch (e) {
      mostraErrore(e, "Account creato, ma non sono riuscito a creare la concessionaria. Riprova.");
      navigate("/benvenuto", { replace: true });
    }
  });

  if (emailInviata) {
    return (
      <AuthLayout title="Controlla la posta" subtitle={<>Ti abbiamo inviato un link di conferma a <strong>{emailInviata}</strong>.</>}>
        <div className="flex gap-4 rounded-lg border bg-accent-soft p-4">
          <MailCheck className="size-6 shrink-0 text-accent" aria-hidden />
          <p className="text-[15px]">
            Apri l'email e tocca il link: tornerai qui e la tua concessionaria sarà pronta. Non la trovi? Guarda anche nella cartella spam.
          </p>
        </div>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link to="/accedi">Vai all'accesso</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Crea la tua concessionaria" subtitle="Bastano due minuti. Potrai invitare i colleghi subito dopo.">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label="Nome della concessionaria" htmlFor="rg-az" required error={err.azienda?.message}>
          <Input id="rg-az" autoComplete="organization" autoFocus aria-invalid={!!err.azienda} {...form.register("azienda")} />
        </Field>
        <Field label="Partita IVA" htmlFor="rg-piva" hint="Facoltativa, puoi aggiungerla dopo." error={err.piva?.message}>
          <Input id="rg-piva" inputMode="numeric" maxLength={11} aria-invalid={!!err.piva} {...form.register("piva")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Il tuo nome" htmlFor="rg-nome" required error={err.nome?.message}>
            <Input id="rg-nome" autoComplete="name" aria-invalid={!!err.nome} {...form.register("nome")} />
          </Field>
          <Field label="Telefono" htmlFor="rg-tel" error={err.telefono?.message}>
            <Input id="rg-tel" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={!!err.telefono} {...form.register("telefono")} />
          </Field>
        </div>
        <Field label="Email" htmlFor="rg-email" required error={err.email?.message}>
          <Input id="rg-email" type="email" inputMode="email" autoComplete="email" aria-invalid={!!err.email} {...form.register("email")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Password" htmlFor="rg-pwd" required error={err.password?.message} hint="Almeno 8 caratteri">
            <Input id="rg-pwd" type="password" autoComplete="new-password" aria-invalid={!!err.password} {...form.register("password")} />
          </Field>
          <Field label="Ripeti password" htmlFor="rg-conf" required error={err.conferma?.message}>
            <Input id="rg-conf" type="password" autoComplete="new-password" aria-invalid={!!err.conferma} {...form.register("conferma")} />
          </Field>
        </div>
        <div>
          <label className="flex min-h-12 cursor-pointer items-start gap-3 text-[15px]">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--accent)]" {...form.register("termini")} />
            Accetto i termini del servizio e l'informativa privacy.
          </label>
          {err.termini && (
            <p role="alert" className="mt-1 text-sm font-medium text-destructive">
              {err.termini.message}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" variant="accent" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          Crea account
        </Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-muted-foreground">
        Hai già un account?{" "}
        <Link to="/accedi" className="font-semibold text-accent hover:underline">
          Accedi
        </Link>
      </p>
    </AuthLayout>
  );
}
