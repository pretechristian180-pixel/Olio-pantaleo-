import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, UserCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { FONTI, opzioni } from "@/lib/labels";
import { etichettaVeicolo, useVeicoliSelezionabili, useVenditori } from "@/lib/queries";
import { emailOpzionale, telefono, testoObbligatorio, vuotoANull } from "@/lib/schemas";
import type { FonteLead } from "@/types/db";
import { cercaContattoPerTelefono, useCreaLead } from "./api";

const schema = z.object({
  nome: testoObbligatorio("il nome"),
  cognome: z.string().trim(),
  telefono,
  email: emailOpzionale,
  fonte: z.enum(Object.keys(FONTI) as [FonteLead, ...FonteLead[]]),
  vehicle_id: z.string(),
  richiesta: z.string().trim().max(2000, "Massimo 2000 caratteri"),
  assegnato_a: z.string(),
  consenso_privacy: z.boolean(),
});
type Valori = z.infer<typeof schema>;

/**
 * "Nuovo lead" rapido: bastano nome e telefono.
 * Se il numero appartiene già a un cliente, propone di collegare il lead a quel contatto.
 */
export default function NuovoLeadDialog({
  open,
  onOpenChange,
  vehicleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicleId?: string;
}) {
  const navigate = useNavigate();
  const { isManager, organizzazione } = useSessione();
  const veicoli = useVeicoliSelezionabili();
  const venditori = useVenditori();
  const crea = useCreaLead();
  const [dettagli, setDettagli] = useState(!!vehicleId);
  const [esistente, setEsistente] = useState<{ id: string; nome: string } | null>(null);
  const [usaEsistente, setUsaEsistente] = useState(false);

  const form = useForm<Valori>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      cognome: "",
      telefono: "",
      email: "",
      fonte: "salone",
      vehicle_id: vehicleId ?? "",
      richiesta: "",
      assegnato_a: "",
      consenso_privacy: false,
    },
  });
  const { register, handleSubmit, formState } = form;
  const err = formState.errors;

  async function controllaDoppione(tel: string) {
    const trovati = await cercaContattoPerTelefono(tel).catch(() => []);
    const c = trovati[0];
    setEsistente(c ? { id: c.id, nome: `${c.nome} ${c.cognome}`.trim() } : null);
    setUsaEsistente(!!c);
  }

  const onSubmit = handleSubmit(async (v) => {
    const scadenza = new Date(Date.now() + organizzazione.tempo_max_risposta_min * 60_000).toISOString();
    try {
      const { id } = await crea.mutateAsync({
        contatto: {
          id: usaEsistente ? esistente?.id : undefined,
          nome: v.nome,
          cognome: v.cognome,
          telefono: v.telefono,
          email: vuotoANull(v.email),
          consenso_privacy: v.consenso_privacy,
        },
        lead: {
          fonte: v.fonte,
          vehicle_id: vuotoANull(v.vehicle_id),
          richiesta: vuotoANull(v.richiesta),
          assegnato_a: vuotoANull(v.assegnato_a),
          // Ogni lead nasce con una prossima azione: il primo contatto entro il tempo massimo.
          prossima_azione_at: scadenza,
          prossima_azione_nota: "Primo contatto",
        },
      });
      toast.success("Lead creato", {
        description: "Contattalo subito: la velocità di risposta fa la vendita.",
        action: { label: "Apri", onClick: () => navigate(`/lead/${id}`) },
      });
      form.reset();
      setEsistente(null);
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare il lead. Riprova.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Nuovo lead" description="Bastano nome e telefono. Il resto puoi aggiungerlo dopo.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" htmlFor="nl-nome" required error={err.nome?.message}>
              <Input id="nl-nome" autoFocus autoComplete="off" aria-invalid={!!err.nome} {...register("nome")} />
            </Field>
            <Field label="Cognome" htmlFor="nl-cognome">
              <Input id="nl-cognome" autoComplete="off" {...register("cognome")} />
            </Field>
          </div>
          <Field label="Telefono" htmlFor="nl-tel" required error={err.telefono?.message}>
            <Input
              id="nl-tel"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              aria-invalid={!!err.telefono}
              {...register("telefono", { onBlur: (e) => void controllaDoppione(e.target.value) })}
            />
          </Field>

          {esistente && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-accent/30 bg-accent-soft p-3">
              <input type="checkbox" className="mt-1 size-5 accent-[var(--accent)]" checked={usaEsistente} onChange={(e) => setUsaEsistente(e.target.checked)} />
              <span className="text-[15px]">
                <span className="flex items-center gap-1.5 font-semibold">
                  <UserCheck className="size-4" aria-hidden /> Cliente già presente: {esistente.nome}
                </span>
                Collega il nuovo lead a questo cliente invece di crearne un doppione.
              </span>
            </label>
          )}

          <Field label="Da dove arriva" htmlFor="nl-fonte">
            <Select id="nl-fonte" {...register("fonte")}>
              {opzioni(FONTI).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          {!dettagli ? (
            <button type="button" onClick={() => setDettagli(true)} className="flex h-11 items-center gap-1.5 font-medium text-accent">
              <ChevronDown className="size-5" aria-hidden /> Altri dettagli (auto, email, richiesta)
            </button>
          ) : (
            <div className="space-y-4">
              <Field label="Auto di interesse" htmlFor="nl-auto">
                <Select id="nl-auto" {...register("vehicle_id")} disabled={veicoli.isLoading}>
                  <option value="">Nessuna in particolare</option>
                  {veicoli.data?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {etichettaVeicolo(v)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Email" htmlFor="nl-email" error={err.email?.message}>
                <Input id="nl-email" type="email" inputMode="email" aria-invalid={!!err.email} {...register("email")} />
              </Field>
              <Field label="Cosa ha chiesto" htmlFor="nl-rich" error={err.richiesta?.message}>
                <Textarea id="nl-rich" className="min-h-24" placeholder="Es. cerca SUV diesel sotto i 20.000 €, ha una Punto da dare in permuta" {...register("richiesta")} />
              </Field>
              {isManager && (
                <Field label="Assegna a" htmlFor="nl-assegna" hint="Con «Automatico» il lead va al venditore con meno lead aperti.">
                  <Select id="nl-assegna" {...register("assegnato_a")}>
                    <option value="">Automatico</option>
                    {venditori.data?.map((p) => (
                      <option key={p.user_id} value={p.user_id}>
                        {p.nome}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px]">
                <input type="checkbox" className="size-5 accent-[var(--accent)]" {...register("consenso_privacy")} />
                Il cliente ha dato il consenso al trattamento dei dati (privacy)
              </label>
            </div>
          )}

          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Spinner />}
            Crea lead
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
