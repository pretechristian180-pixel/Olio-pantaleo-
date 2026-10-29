import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { FONTI, opzioni } from "@/lib/labels";
import { etichettaVeicolo, useVeicoliSelezionabili, useVenditori } from "@/lib/queries";
import { aNumero, numeroOpzionale, vuotoANull } from "@/lib/schemas";
import type { Contact, FonteLead } from "@/types/db";
import { useCreaLead } from "@/features/leads/api";

const schema = z.object({
  fonte: z.enum(Object.keys(FONTI) as [FonteLead, ...FonteLead[]]),
  vehicle_id: z.string(),
  budget: numeroOpzionale("Budget non valido"),
  richiesta: z.string().trim().max(2000, "Massimo 2000 caratteri"),
  assegnato_a: z.string(),
});
type Valori = z.infer<typeof schema>;

/** Nuovo lead per un cliente già in archivio (es. torna per cambiare auto). */
export function NuovoLeadClienteDialog({ contatto, open, onOpenChange }: { contatto: Contact; open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { isManager, organizzazione } = useSessione();
  const veicoli = useVeicoliSelezionabili();
  const venditori = useVenditori();
  const crea = useCreaLead();
  const form = useForm<Valori>({
    resolver: zodResolver(schema),
    defaultValues: {
      fonte: contatto.fonte ?? "salone",
      vehicle_id: "",
      budget: "",
      richiesta: "",
      assegnato_a: contatto.venditore_assegnato ?? "",
    },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const { id } = await crea.mutateAsync({
        contatto: { ...contatto, id: contatto.id },
        lead: {
          fonte: v.fonte,
          vehicle_id: vuotoANull(v.vehicle_id),
          budget: aNumero(v.budget),
          richiesta: vuotoANull(v.richiesta),
          assegnato_a: isManager ? vuotoANull(v.assegnato_a) : undefined,
          prossima_azione_at: new Date(Date.now() + organizzazione.tempo_max_risposta_min * 60_000).toISOString(),
          prossima_azione_nota: "Primo contatto",
        },
      });
      toast.success("Lead creato", { action: { label: "Apri", onClick: () => navigate(`/lead/${id}`) } });
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a creare il lead.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Nuovo lead" description={`Per ${contatto.nome} ${contatto.cognome}`.trim()}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Da dove arriva" htmlFor="nlc-fonte">
            <Select id="nlc-fonte" {...form.register("fonte")}>
              {opzioni(FONTI).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Auto di interesse" htmlFor="nlc-auto">
            <Select id="nlc-auto" {...form.register("vehicle_id")}>
              <option value="">Nessuna in particolare</option>
              {veicoli.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {etichettaVeicolo(v)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Budget (€)" htmlFor="nlc-budget" error={err.budget?.message}>
            <Input id="nlc-budget" inputMode="decimal" aria-invalid={!!err.budget} {...form.register("budget")} />
          </Field>
          <Field label="Cosa cerca" htmlFor="nlc-rich" error={err.richiesta?.message}>
            <Textarea id="nlc-rich" className="min-h-20" {...form.register("richiesta")} />
          </Field>
          {isManager && (
            <Field label="Assegna a" htmlFor="nlc-ass" hint="Con «Automatico» va al venditore con meno lead aperti.">
              <Select id="nlc-ass" {...form.register("assegnato_a")}>
                <option value="">Automatico</option>
                {venditori.data?.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button type="submit" variant="accent" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            Crea lead
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
