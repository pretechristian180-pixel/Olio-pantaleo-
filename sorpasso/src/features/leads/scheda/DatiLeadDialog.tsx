import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { FONTI, TEMPISTICHE, opzioni } from "@/lib/labels";
import { etichettaVeicolo, useVeicoliSelezionabili, useVenditori } from "@/lib/queries";
import { aNumero, numeroOpzionale, vuotoANull } from "@/lib/schemas";
import type { FonteLead, LeadView, Tempistica } from "@/types/db";
import { useAggiornaLead } from "../api";

const anno = new Date().getFullYear();

const schema = z
  .object({
    fonte: z.enum(Object.keys(FONTI) as [FonteLead, ...FonteLead[]]),
    vehicle_id: z.string(),
    marca_interesse: z.string().trim().max(60),
    modello_interesse: z.string().trim().max(60),
    budget: numeroOpzionale("Budget non valido"),
    tempistica: z.enum(Object.keys(TEMPISTICHE) as [Tempistica, ...Tempistica[]]),
    finanziamento: z.boolean(),
    permuta: z.boolean(),
    permuta_marca: z.string().trim().max(60),
    permuta_modello: z.string().trim().max(60),
    permuta_anno: numeroOpzionale("Anno non valido").refine((v) => v === "" || (Number(v) >= 1950 && Number(v) <= anno), "Anno non valido"),
    permuta_km: numeroOpzionale("Km non validi"),
    richiesta: z.string().trim().max(2000, "Massimo 2000 caratteri"),
    assegnato_a: z.string(),
  })
  .refine((v) => !v.permuta || v.permuta_marca.length > 0, { path: ["permuta_marca"], message: "Indica almeno la marca dell'auto in permuta" });
type Valori = z.infer<typeof schema>;

/** Modifica dei dati di qualifica del lead: cosa cerca, budget, permuta, finanziamento, tempi. */
export function DatiLeadDialog({ lead, open, onOpenChange }: { lead: LeadView; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { isManager } = useSessione();
  const veicoli = useVeicoliSelezionabili();
  const venditori = useVenditori();
  const aggiorna = useAggiornaLead();
  const form = useForm<Valori>({ resolver: zodResolver(schema) });
  const err = form.formState.errors;
  const permuta = form.watch("permuta");
  const finanziamento = form.watch("finanziamento");

  useEffect(() => {
    if (!open) return;
    const p = lead.permuta_dati ?? {};
    form.reset({
      fonte: lead.fonte,
      vehicle_id: lead.vehicle_id ?? "",
      marca_interesse: lead.marca_interesse ?? "",
      modello_interesse: lead.modello_interesse ?? "",
      budget: lead.budget != null ? String(lead.budget) : "",
      tempistica: lead.tempistica,
      finanziamento: lead.finanziamento,
      permuta: lead.permuta,
      permuta_marca: p.marca ?? "",
      permuta_modello: p.modello ?? "",
      permuta_anno: p.anno != null ? String(p.anno) : "",
      permuta_km: p.km != null ? String(p.km) : "",
      richiesta: lead.richiesta ?? "",
      assegnato_a: lead.assegnato_a ?? "",
    });
  }, [open, lead, form]);

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await aggiorna.mutateAsync({
        id: lead.id,
        fonte: v.fonte,
        vehicle_id: vuotoANull(v.vehicle_id),
        marca_interesse: vuotoANull(v.marca_interesse),
        modello_interesse: vuotoANull(v.modello_interesse),
        budget: aNumero(v.budget),
        tempistica: v.tempistica,
        finanziamento: v.finanziamento,
        permuta: v.permuta,
        permuta_dati: v.permuta
          ? { marca: v.permuta_marca, modello: v.permuta_modello, anno: aNumero(v.permuta_anno), km: aNumero(v.permuta_km) }
          : null,
        richiesta: vuotoANull(v.richiesta),
        ...(isManager ? { assegnato_a: vuotoANull(v.assegnato_a) } : {}),
      });
      toast.success("Dati del lead aggiornati");
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e);
    }
  });

  const veicoloFuoriLista = lead.vehicle_id && veicoli.data && !veicoli.data.some((x) => x.id === lead.vehicle_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Dati del lead" description="Più sai del cliente, più è facile proporgli l'auto giusta.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Auto di interesse" htmlFor="dl-auto">
            <Select id="dl-auto" {...form.register("vehicle_id")}>
              <option value="">Nessuna auto specifica in stock</option>
              {veicoloFuoriLista && <option value={lead.vehicle_id!}>{`${lead.veicolo_marca} ${lead.veicolo_modello} (venduta)`}</option>}
              {veicoli.data?.map((x) => (
                <option key={x.id} value={x.id}>
                  {etichettaVeicolo(x)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marca cercata" htmlFor="dl-marca" hint="Serve a proporgli le auto che entrano in stock">
              <Input id="dl-marca" {...form.register("marca_interesse")} />
            </Field>
            <Field label="Modello cercato" htmlFor="dl-modello">
              <Input id="dl-modello" {...form.register("modello_interesse")} />
            </Field>
            <Field label="Budget (€)" htmlFor="dl-budget" error={err.budget?.message}>
              <Input id="dl-budget" inputMode="decimal" aria-invalid={!!err.budget} {...form.register("budget")} />
            </Field>
            <Field label="Quando vuole comprare" htmlFor="dl-tempi">
              <Select id="dl-tempi" {...form.register("tempistica")}>
                {opzioni(TEMPISTICHE).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Switch
            id="dl-fin"
            label="Vuole un finanziamento"
            checked={finanziamento ?? false}
            onChange={(v) => form.setValue("finanziamento", v)}
          />
          <Switch
            id="dl-perm"
            label="Ha un'auto da dare in permuta"
            checked={permuta ?? false}
            onChange={(v) => form.setValue("permuta", v, { shouldValidate: form.formState.isSubmitted })}
          />
          {permuta && (
            <div className="grid gap-4 rounded-lg bg-muted p-4 sm:grid-cols-2">
              <Field label="Marca" htmlFor="dl-pm" required error={err.permuta_marca?.message}>
                <Input id="dl-pm" aria-invalid={!!err.permuta_marca} {...form.register("permuta_marca")} />
              </Field>
              <Field label="Modello" htmlFor="dl-pmod">
                <Input id="dl-pmod" {...form.register("permuta_modello")} />
              </Field>
              <Field label="Anno" htmlFor="dl-pa" error={err.permuta_anno?.message}>
                <Input id="dl-pa" inputMode="numeric" {...form.register("permuta_anno")} />
              </Field>
              <Field label="Km" htmlFor="dl-pkm" error={err.permuta_km?.message}>
                <Input id="dl-pkm" inputMode="numeric" {...form.register("permuta_km")} />
              </Field>
            </div>
          )}
          <Field label="Fonte" htmlFor="dl-fonte">
            <Select id="dl-fonte" {...form.register("fonte")}>
              {opzioni(FONTI).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          {isManager && (
            <Field label="Venditore" htmlFor="dl-vend">
              <Select id="dl-vend" {...form.register("assegnato_a")}>
                <option value="">Non assegnato</option>
                {venditori.data?.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Richiesta del cliente" htmlFor="dl-rich" error={err.richiesta?.message}>
            <Textarea id="dl-rich" className="min-h-24" {...form.register("richiesta")} />
          </Field>
          <Button type="submit" variant="accent" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            Salva
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
