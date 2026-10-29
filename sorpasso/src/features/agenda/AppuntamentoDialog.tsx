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
import { STATI_APPUNTAMENTO, TIPI_APPUNTAMENTO, opzioni } from "@/lib/labels";
import { etichettaVeicolo, useVeicoliSelezionabili, useVenditori } from "@/lib/queries";
import { toDateTimeLocal } from "@/lib/format";
import type { Appointment, StatoAppuntamento, TipoAppuntamento } from "@/types/db";
import { useEliminaAppuntamento, useSalvaAppuntamento } from "./api";

const DURATE = [
  { value: "30", label: "30 minuti" },
  { value: "45", label: "45 minuti" },
  { value: "60", label: "1 ora" },
  { value: "90", label: "1 ora e mezza" },
  { value: "120", label: "2 ore" },
];

const schema = z.object({
  tipo: z.enum(Object.keys(TIPI_APPUNTAMENTO) as [TipoAppuntamento, ...TipoAppuntamento[]]),
  inizio: z
    .string()
    .min(1, "Scegli data e ora")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Data non valida"),
  durata: z.string(),
  vehicle_id: z.string(),
  assegnato_a: z.string().min(1, "Scegli a chi assegnarlo"),
  stato: z.enum(Object.keys(STATI_APPUNTAMENTO) as [StatoAppuntamento, ...StatoAppuntamento[]]),
  note: z.string().trim().max(1000, "Massimo 1000 caratteri"),
});
type Valori = z.infer<typeof schema>;

export interface AppuntamentoIniziale {
  tipo?: TipoAppuntamento;
  lead_id?: string | null;
  contact_id?: string | null;
  vehicle_id?: string | null;
  assegnato_a?: string | null;
  inizio?: Date;
  /** Testo mostrato sotto il titolo, es. il nome del cliente. */
  cliente?: string;
}

/** Prossima mezz'ora piena, almeno tra un'ora (comodo come proposta). */
function proposta() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}

/**
 * Nuovo appuntamento o modifica di uno esistente.
 * Usato da Agenda, scheda lead ("Fissa test drive") e pratiche ("Fissa consegna").
 */
export default function AppuntamentoDialog({
  open,
  onOpenChange,
  iniziale,
  appuntamento,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  iniziale?: AppuntamentoIniziale;
  appuntamento?: Appointment;
}) {
  const { userId, isManager } = useSessione();
  const veicoli = useVeicoliSelezionabili();
  const venditori = useVenditori();
  const salva = useSalvaAppuntamento();
  const elimina = useEliminaAppuntamento();

  const form = useForm<Valori>({ resolver: zodResolver(schema) });
  const err = form.formState.errors;

  // Il form si inizializza solo all'apertura: un nuovo oggetto `iniziale` non cancella ciò che l'utente sta scrivendo.
  useEffect(() => {
    if (!open) return;
    const durataMin = appuntamento
      ? String(Math.round((new Date(appuntamento.fine).getTime() - new Date(appuntamento.inizio).getTime()) / 60000))
      : iniziale?.tipo === "consegna"
        ? "60"
        : "45";
    form.reset({
      tipo: appuntamento?.tipo ?? iniziale?.tipo ?? "test_drive",
      inizio: toDateTimeLocal(appuntamento?.inizio ?? iniziale?.inizio ?? proposta()),
      durata: DURATE.some((d) => d.value === durataMin) ? durataMin : "60",
      vehicle_id: appuntamento?.vehicle_id ?? iniziale?.vehicle_id ?? "",
      assegnato_a: appuntamento?.assegnato_a ?? iniziale?.assegnato_a ?? userId,
      stato: appuntamento?.stato ?? "programmato",
      note: appuntamento?.note ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appuntamento?.id]);

  const onSubmit = form.handleSubmit(async (v) => {
    const inizio = new Date(v.inizio);
    const fine = new Date(inizio.getTime() + Number(v.durata) * 60_000);
    try {
      await salva.mutateAsync({
        id: appuntamento?.id,
        tipo: v.tipo,
        inizio: inizio.toISOString(),
        fine: fine.toISOString(),
        vehicle_id: v.vehicle_id || null,
        assegnato_a: v.assegnato_a,
        note: v.note || null,
        ...(appuntamento
          ? { stato: v.stato }
          : { lead_id: iniziale?.lead_id ?? null, contact_id: iniziale?.contact_id ?? null }),
      });
      toast.success(appuntamento ? "Appuntamento aggiornato" : "Appuntamento fissato");
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare l'appuntamento.");
    }
  });

  async function onElimina() {
    if (!appuntamento || !window.confirm("Eliminare questo appuntamento?")) return;
    try {
      await elimina.mutateAsync(appuntamento.id);
      toast.success("Appuntamento eliminato");
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e);
    }
  }

  // Un'auto venduta collegata a un vecchio appuntamento non è nella lista: la manteniamo selezionabile.
  const veicoloCorrente = appuntamento?.vehicle_id ?? iniziale?.vehicle_id;
  const veicoloFuoriLista = veicoloCorrente && veicoli.data && !veicoli.data.some((v) => v.id === veicoloCorrente);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={appuntamento ? "Modifica appuntamento" : "Nuovo appuntamento"} description={iniziale?.cliente}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Tipo" htmlFor="ap-tipo">
            <Select id="ap-tipo" {...form.register("tipo")}>
              {opzioni(TIPI_APPUNTAMENTO).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Giorno e ora" htmlFor="ap-inizio" required error={err.inizio?.message}>
              <Input id="ap-inizio" type="datetime-local" step={900} aria-invalid={!!err.inizio} {...form.register("inizio")} />
            </Field>
            <Field label="Durata" htmlFor="ap-durata">
              <Select id="ap-durata" {...form.register("durata")}>
                {DURATE.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Auto" htmlFor="ap-auto">
            <Select id="ap-auto" {...form.register("vehicle_id")}>
              <option value="">Nessuna</option>
              {veicoloFuoriLista && <option value={veicoloCorrente}>Auto collegata (non più in stock)</option>}
              {veicoli.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {etichettaVeicolo(v)}
                </option>
              ))}
            </Select>
          </Field>
          {isManager && (
            <Field label="Con chi" htmlFor="ap-chi" error={err.assegnato_a?.message}>
              <Select id="ap-chi" {...form.register("assegnato_a")}>
                {venditori.data?.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {appuntamento && (
            <Field label="Esito" htmlFor="ap-stato">
              <Select id="ap-stato" {...form.register("stato")}>
                {opzioni(STATI_APPUNTAMENTO).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Note" htmlFor="ap-note" error={err.note?.message}>
            <Textarea id="ap-note" className="min-h-20" placeholder="Es. portare documenti per la valutazione" {...form.register("note")} />
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {appuntamento ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={onElimina} disabled={elimina.isPending}>
                Elimina
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Spinner />}
              {appuntamento ? "Salva modifiche" : "Fissa appuntamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
