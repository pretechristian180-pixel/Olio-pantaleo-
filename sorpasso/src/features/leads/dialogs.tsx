import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/shared/States";
import { mostraErrore } from "@/lib/errors";
import { MOTIVI_PERSO } from "@/lib/labels";
import { etichettaVeicolo, useVeicoliSelezionabili } from "@/lib/queries";
import { aNumero, numeroOpzionale } from "@/lib/schemas";
import { useCambiaStato, useChiudiVendita } from "./api";

const schemaPerso = z
  .object({ motivo: z.string().min(1, "Scegli un motivo"), dettaglio: z.string().trim().max(300, "Massimo 300 caratteri") })
  .refine((v) => v.motivo !== "Altro" || v.dettaglio.length > 0, { path: ["dettaglio"], message: "Descrivi il motivo" });

/** "Segna come perso": il motivo è obbligatorio (serve ai report). */
export function PersoDialog({
  leadId,
  open,
  onOpenChange,
  onFatto,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onFatto?: () => void;
}) {
  const cambia = useCambiaStato();
  const form = useForm<z.infer<typeof schemaPerso>>({ resolver: zodResolver(schemaPerso), defaultValues: { motivo: "", dettaglio: "" } });
  const motivo = form.watch("motivo");
  const err = form.formState.errors;

  useEffect(() => {
    if (open) form.reset({ motivo: "", dettaglio: "" });
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (v) => {
    const testo = v.motivo === "Altro" ? v.dettaglio : v.dettaglio ? `${v.motivo} – ${v.dettaglio}` : v.motivo;
    try {
      await cambia.mutateAsync({ id: leadId, stato: "perso", motivo_perso: testo });
      toast.success("Lead segnato come perso");
      onOpenChange(false);
      onFatto?.();
    } catch (e) {
      mostraErrore(e);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Segna come perso" description="Il motivo ci aiuta a capire dove migliorare.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Motivo" htmlFor="perso-motivo" required error={err.motivo?.message}>
            <Select id="perso-motivo" aria-invalid={!!err.motivo} {...form.register("motivo")}>
              <option value="">Scegli…</option>
              {MOTIVI_PERSO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={motivo === "Altro" ? "Descrivi il motivo" : "Dettagli (facoltativo)"}
            htmlFor="perso-dett"
            required={motivo === "Altro"}
            error={err.dettaglio?.message}
          >
            <Textarea id="perso-dett" className="min-h-20" {...form.register("dettaglio")} />
          </Field>
          <Button type="submit" variant="destructive" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            Segna come perso
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const schemaVendita = z.object({
  vehicle_id: z.string().min(1, "Scegli l'auto venduta"),
  prezzo: numeroOpzionale("Inserisci un prezzo valido").refine((v) => v.trim() !== "", "Inserisci il prezzo finale"),
});

/** "Chiudi vendita": crea la pratica (auto + prezzo finale). */
export function ChiudiVenditaDialog({
  leadId,
  vehicleId,
  prezzoProposto,
  open,
  onOpenChange,
  onFatto,
}: {
  leadId: string;
  vehicleId?: string | null;
  prezzoProposto?: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onFatto?: (dealId: string) => void;
}) {
  const veicoli = useVeicoliSelezionabili();
  const chiudi = useChiudiVendita();
  const form = useForm<z.infer<typeof schemaVendita>>({ resolver: zodResolver(schemaVendita) });
  const err = form.formState.errors;
  const vid = form.watch("vehicle_id");

  useEffect(() => {
    if (open) form.reset({ vehicle_id: vehicleId ?? "", prezzo: prezzoProposto != null ? String(prezzoProposto) : "" });
  }, [open, vehicleId, prezzoProposto, form]);

  // Quando si cambia auto, propone il suo prezzo di vendita.
  useEffect(() => {
    if (!vid || vid === vehicleId) return;
    const v = veicoli.data?.find((x) => x.id === vid);
    if (v?.prezzo_vendita != null) form.setValue("prezzo", String(v.prezzo_vendita));
  }, [vid, vehicleId, veicoli.data, form]);

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const { id } = await chiudi.mutateAsync({ lead_id: leadId, vehicle_id: v.vehicle_id, prezzo_finale: aNumero(v.prezzo)! });
      toast.success("Vendita chiusa!", { description: "La pratica è pronta in «Pratiche»." });
      onOpenChange(false);
      onFatto?.(id);
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a chiudere la vendita.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Chiudi vendita" description="Crea la pratica: l'auto passa a «venduta» e il lead a «vinto».">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Auto venduta" htmlFor="cv-auto" required error={err.vehicle_id?.message}>
            <Select id="cv-auto" aria-invalid={!!err.vehicle_id} {...form.register("vehicle_id")} disabled={veicoli.isLoading}>
              <option value="">Scegli l'auto…</option>
              {veicoli.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {etichettaVeicolo(v)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prezzo finale (€)" htmlFor="cv-prezzo" required error={err.prezzo?.message}>
            <Input id="cv-prezzo" inputMode="decimal" aria-invalid={!!err.prezzo} {...form.register("prezzo")} />
          </Field>
          <Button type="submit" variant="success" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            Conferma vendita
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
