import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/shared/States";
import { addDays, dataOra, relativo, startOfDay, toDateTimeLocal } from "@/lib/format";
import { mostraErrore } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { LeadView } from "@/types/db";
import { useAggiornaLead } from "../api";

const schema = z.object({
  quando: z
    .string()
    .min(1, "La data della prossima azione è obbligatoria")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Data non valida"),
  nota: z.string().trim().min(1, "Scrivi cosa fare (es. Richiamare per test drive)").max(200, "Massimo 200 caratteri"),
});

const SCORCIATOIE: { label: string; data: () => Date }[] = [
  { label: "Tra 1 ora", data: () => new Date(Date.now() + 60 * 60_000) },
  { label: "Domani alle 10", data: () => new Date(addDays(startOfDay(), 1).setHours(10)) },
  { label: "Tra 3 giorni", data: () => new Date(addDays(startOfDay(), 3).setHours(10)) },
  { label: "Tra una settimana", data: () => new Date(addDays(startOfDay(), 7).setHours(10)) },
];

/** Prossima azione: obbligatoria per ogni lead aperto. Sempre in cima alla scheda. */
export function ProssimaAzione({ lead, sola_lettura }: { lead: LeadView; sola_lettura: boolean }) {
  const aggiorna = useAggiornaLead();
  const manca = !lead.prossima_azione_at;
  const [modifica, setModifica] = useState(manca && !sola_lettura);
  const scaduta = !!lead.prossima_azione_at && new Date(lead.prossima_azione_at) < new Date();

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const err = form.formState.errors;

  useEffect(() => {
    form.reset({
      quando: lead.prossima_azione_at ? toDateTimeLocal(lead.prossima_azione_at) : "",
      nota: lead.prossima_azione_nota ?? "",
    });
  }, [lead.prossima_azione_at, lead.prossima_azione_nota, form]);

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await aggiorna.mutateAsync({ id: lead.id, prossima_azione_at: new Date(v.quando).toISOString(), prossima_azione_nota: v.nota });
      toast.success("Prossima azione salvata");
      setModifica(false);
    } catch (e) {
      mostraErrore(e);
    }
  });

  return (
    <section
      className={cn(
        "rounded-lg border p-4 shadow-card sm:p-5",
        manca ? "border-warning/40 bg-warning-soft" : scaduta ? "border-destructive/40 bg-destructive-soft" : "bg-card",
      )}
      aria-label="Prossima azione"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {manca ? (
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-warning" aria-hidden />
          ) : (
            <CalendarClock className={cn("mt-0.5 size-6 shrink-0", scaduta ? "text-destructive" : "text-accent")} aria-hidden />
          )}
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Prossima azione</p>
            {manca ? (
              <p className="text-lg font-semibold">Nessuna prossima azione: decidi ora cosa fare e quando.</p>
            ) : (
              <>
                <p className="text-lg font-semibold">{lead.prossima_azione_nota || "Da definire"}</p>
                <p className={cn("text-[15px]", scaduta ? "font-semibold text-destructive" : "text-muted-foreground")}>
                  {dataOra(lead.prossima_azione_at)} · {scaduta ? `scaduta ${relativo(lead.prossima_azione_at)}` : relativo(lead.prossima_azione_at)}
                </p>
              </>
            )}
          </div>
        </div>
        {!sola_lettura && !modifica && (
          <Button variant="outline" size="sm" onClick={() => setModifica(true)}>
            <Pencil aria-hidden /> Cambia
          </Button>
        )}
      </div>

      {modifica && !sola_lettura && (
        <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
          <div className="flex flex-wrap gap-2">
            {SCORCIATOIE.map((s) => (
              <Button
                key={s.label}
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => form.setValue("quando", toDateTimeLocal(s.data()), { shouldValidate: true })}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
            <Field label="Quando" htmlFor="pa-quando" required error={err.quando?.message}>
              <Input id="pa-quando" type="datetime-local" step={900} aria-invalid={!!err.quando} {...form.register("quando")} />
            </Field>
            <Field label="Cosa fare" htmlFor="pa-nota" required error={err.nota?.message}>
              <Input id="pa-nota" placeholder="Es. Richiamare per fissare il test drive" aria-invalid={!!err.nota} {...form.register("nota")} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Spinner />}
              Salva
            </Button>
            {!manca && (
              <Button type="button" variant="ghost" onClick={() => setModifica(false)}>
                Annulla
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
