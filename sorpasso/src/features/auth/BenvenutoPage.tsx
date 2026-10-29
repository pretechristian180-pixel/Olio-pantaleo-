import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PageLoader, Spinner } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { AuthLayout } from "./AuthLayout";
import { campiAzienda, creaOrganizzazione } from "./schemaAzienda";

const schema = z.object(campiAzienda);
type Valori = z.infer<typeof schema>;

/** Utente con email confermata ma senza concessionaria: completa la creazione. */
export default function BenvenutoPage() {
  const { session, profilo, caricamento, ricarica, esci } = useAuth();
  const navigate = useNavigate();
  const meta = (session?.user.user_metadata ?? {}) as Partial<Record<keyof Valori, string>>;
  const form = useForm<Valori>({
    resolver: zodResolver(schema),
    values: { azienda: meta.azienda ?? "", piva: meta.piva ?? "", nome: meta.nome ?? "", telefono: meta.telefono ?? "" },
  });
  const err = form.formState.errors;

  if (caricamento) return <PageLoader />;
  if (!session) return <Navigate to="/accedi" replace />;
  if (profilo) return <Navigate to="/" replace />;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await creaOrganizzazione(v);
      await ricarica();
      navigate("/", { replace: true });
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a creare la concessionaria. Riprova.");
    }
  });

  return (
    <AuthLayout title="Ultimo passo" subtitle="Conferma i dati della tua concessionaria e sei dentro.">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label="Nome della concessionaria" htmlFor="bv-az" required error={err.azienda?.message}>
          <Input id="bv-az" aria-invalid={!!err.azienda} {...form.register("azienda")} />
        </Field>
        <Field label="Partita IVA" htmlFor="bv-piva" error={err.piva?.message}>
          <Input id="bv-piva" inputMode="numeric" maxLength={11} aria-invalid={!!err.piva} {...form.register("piva")} />
        </Field>
        <Field label="Il tuo nome" htmlFor="bv-nome" required error={err.nome?.message}>
          <Input id="bv-nome" aria-invalid={!!err.nome} {...form.register("nome")} />
        </Field>
        <Field label="Telefono" htmlFor="bv-tel" error={err.telefono?.message}>
          <Input id="bv-tel" type="tel" inputMode="tel" aria-invalid={!!err.telefono} {...form.register("telefono")} />
        </Field>
        <Button type="submit" size="lg" variant="accent" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          Entra in Sorpasso
        </Button>
      </form>
      <p className="mt-6 text-center text-[15px] text-muted-foreground">
        Sei stato invitato da un collega? Usa il link nell'email di invito oppure{" "}
        <button type="button" onClick={() => void esci()} className="font-semibold text-accent hover:underline">
          esci
        </button>
        .
      </p>
    </AuthLayout>
  );
}
