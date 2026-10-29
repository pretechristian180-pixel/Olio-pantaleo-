import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Section } from "@/components/shared/Section";
import { Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore, ok } from "@/lib/errors";
import { RUOLI } from "@/lib/labels";
import { qk } from "@/lib/queries";
import { telefonoOpzionale, testoObbligatorio, vuotoANull } from "@/lib/schemas";
import { supabase } from "@/lib/supabase";

const schema = z.object({ nome: testoObbligatorio("il nome"), telefono: telefonoOpzionale });
type Valori = z.infer<typeof schema>;

export function ProfiloTab() {
  const { profilo, ruolo, ricarica } = useSessione();
  const qc = useQueryClient();
  const form = useForm<Valori>({
    resolver: zodResolver(schema),
    values: { nome: profilo.nome, telefono: profilo.telefono ?? "" },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      ok(await supabase.from("profiles").update({ nome: v.nome, telefono: vuotoANull(v.telefono) }).eq("user_id", profilo.user_id));
      await Promise.all([ricarica(), qc.invalidateQueries({ queryKey: qk.colleghi })]);
      toast.success("Profilo aggiornato");
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare il profilo.");
    }
  });

  return (
    <Section title="I tuoi dati">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Nome e cognome" htmlFor="pr-nome" required error={err.nome?.message} hint="Compare nei messaggi ai clienti e nei report.">
          <Input id="pr-nome" aria-invalid={!!err.nome} {...form.register("nome")} />
        </Field>
        <Field label="Telefono" htmlFor="pr-tel" error={err.telefono?.message}>
          <Input id="pr-tel" type="tel" inputMode="tel" aria-invalid={!!err.telefono} {...form.register("telefono")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email di accesso" htmlFor="pr-email">
            <Input id="pr-email" value={profilo.email ?? ""} disabled readOnly />
          </Field>
          <Field label="Ruolo" htmlFor="pr-ruolo" hint="Lo può cambiare solo il titolare.">
            <Input id="pr-ruolo" value={RUOLI[ruolo]} disabled readOnly />
          </Field>
        </div>
        <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
          {form.formState.isSubmitting && <Spinner />}
          Salva
        </Button>
      </form>
    </Section>
  );
}
