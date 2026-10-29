import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { useVenditori } from "@/lib/queries";
import { emailOpzionale, telefonoOpzionale, testoObbligatorio, vuotoANull } from "@/lib/schemas";
import type { Contact } from "@/types/db";
import { useAggiornaContatto } from "./api";

const schema = z
  .object({
    nome: testoObbligatorio("il nome"),
    cognome: z.string().trim().max(100),
    telefono: telefonoOpzionale,
    email: emailOpzionale,
    comune: z.string().trim().max(100),
    tag: z.string().trim().max(300),
    note: z.string().trim().max(2000, "Massimo 2000 caratteri"),
    venditore_assegnato: z.string(),
  })
  .refine((v) => v.telefono !== "" || v.email !== "", { message: "Serve almeno telefono o email", path: ["telefono"] });
type Valori = z.infer<typeof schema>;

/** Modifica dei dati anagrafici del cliente. */
export function ModificaClienteDialog({ contatto, open, onOpenChange }: { contatto: Contact; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { isManager } = useSessione();
  const venditori = useVenditori();
  const aggiorna = useAggiornaContatto();
  const form = useForm<Valori>({ resolver: zodResolver(schema) });
  const err = form.formState.errors;

  useEffect(() => {
    if (open)
      form.reset({
        nome: contatto.nome,
        cognome: contatto.cognome,
        telefono: contatto.telefono ?? "",
        email: contatto.email ?? "",
        comune: contatto.comune ?? "",
        tag: contatto.tag.join(", "),
        note: contatto.note ?? "",
        venditore_assegnato: contatto.venditore_assegnato ?? "",
      });
  }, [open, contatto, form]);

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await aggiorna.mutateAsync({
        id: contatto.id,
        nome: v.nome,
        cognome: v.cognome,
        telefono: vuotoANull(v.telefono),
        email: vuotoANull(v.email),
        comune: vuotoANull(v.comune),
        note: vuotoANull(v.note),
        tag: [...new Set(v.tag.split(",").map((t) => t.trim()).filter(Boolean))],
        ...(isManager ? { venditore_assegnato: vuotoANull(v.venditore_assegnato) } : {}),
      });
      toast.success("Dati del cliente aggiornati");
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare le modifiche.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Modifica cliente">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" htmlFor="mc-nome" required error={err.nome?.message}>
              <Input id="mc-nome" aria-invalid={!!err.nome} {...form.register("nome")} />
            </Field>
            <Field label="Cognome" htmlFor="mc-cognome">
              <Input id="mc-cognome" {...form.register("cognome")} />
            </Field>
            <Field label="Telefono" htmlFor="mc-tel" error={err.telefono?.message}>
              <Input id="mc-tel" type="tel" inputMode="tel" aria-invalid={!!err.telefono} {...form.register("telefono")} />
            </Field>
            <Field label="Email" htmlFor="mc-email" error={err.email?.message}>
              <Input id="mc-email" type="email" inputMode="email" aria-invalid={!!err.email} {...form.register("email")} />
            </Field>
          </div>
          <Field label="Comune" htmlFor="mc-comune">
            <Input id="mc-comune" {...form.register("comune")} />
          </Field>
          <Field label="Etichette" htmlFor="mc-tag" hint="Separate da virgola, es. famiglia, flotta aziendale, cliente storico">
            <Input id="mc-tag" {...form.register("tag")} />
          </Field>
          {isManager && (
            <Field label="Venditore di riferimento" htmlFor="mc-vend">
              <Select id="mc-vend" {...form.register("venditore_assegnato")}>
                <option value="">Nessuno</option>
                {venditori.data?.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Note" htmlFor="mc-note" error={err.note?.message}>
            <Textarea id="mc-note" className="min-h-24" {...form.register("note")} />
          </Field>
          <Button type="submit" variant="accent" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            Salva modifiche
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
