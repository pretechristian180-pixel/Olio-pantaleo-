import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Switch } from "@/components/ui/input";
import { Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton, Spinner } from "@/components/shared/States";
import { EmptyState } from "@/components/shared/EmptyState";
import { useSessione } from "@/lib/auth";
import { mostraErrore, ok } from "@/lib/errors";
import { dataOra } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { supabase } from "@/lib/supabase";
import type { AutomationLog } from "@/types/db";
import { DecoderSection } from "./DecoderSection";

const intero = (min: number, max: number, cosa: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, `${cosa}: un numero tra ${min} e ${max}`);

const schema = z.object({
  soglia_giacenza_giorni: intero(1, 3650, "Giorni"),
  tempo_max_risposta_min: intero(1, 10080, "Minuti"),
  round_robin_attivo: z.boolean(),
});
type Valori = z.infer<typeof schema>;

const TIPI_LOG: Record<string, string> = {
  assegnazione_round_robin: "Lead assegnato in automatico",
  notifica_lead_in_ritardo: "Avviso lead non contattato",
  vendita_chiusa: "Vendita chiusa: auto segnata come venduta",
  ai_descrizione_annuncio: "AI · descrizione annuncio",
  ai_suggerisci_risposta: "AI · risposta suggerita",
  ai_riassunto_lead: "AI · riassunto lead",
  decodifica_veicolo: "Decodifica targa/telaio",
  lead_da_scheda_pubblica: "Lead dalla scheda online dell'auto",
};
const ESITI: Record<AutomationLog["esito"], { label: string; tone: Tone }> = {
  ok: { label: "Ok", tone: "green" },
  saltato: { label: "Saltato", tone: "yellow" },
  errore: { label: "Errore", tone: "red" },
};

export function SoglieTab() {
  const { organizzazione: org, isTitolare, ricarica } = useSessione();
  const form = useForm<Valori>({
    resolver: zodResolver(schema),
    values: {
      soglia_giacenza_giorni: String(org.soglia_giacenza_giorni),
      tempo_max_risposta_min: String(org.tempo_max_risposta_min),
      round_robin_attivo: org.round_robin_attivo,
    },
  });
  const err = form.formState.errors;

  const log = useQuery({
    queryKey: ["automazioni-log"],
    queryFn: async () =>
      ok(await supabase.from("automations_log").select("*").order("created_at", { ascending: false }).limit(30)) as AutomationLog[],
  });

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      ok(
        await supabase
          .from("organizations")
          .update({
            soglia_giacenza_giorni: Number(v.soglia_giacenza_giorni),
            tempo_max_risposta_min: Number(v.tempo_max_risposta_min),
            round_robin_attivo: v.round_robin_attivo,
          })
          .eq("id", org.id),
      );
      await ricarica();
      toast.success("Regole aggiornate");
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare le regole.");
    }
  });

  return (
    <div className="space-y-6">
      <Section title="Regole automatiche">
        {!isTitolare && <p className="mb-4 rounded-lg bg-muted px-4 py-3 text-[15px] text-muted-foreground">Solo il titolare può modificare queste regole.</p>}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <fieldset disabled={!isTitolare} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Tempo massimo di risposta (minuti)"
                htmlFor="sg-tempo"
                error={err.tempo_max_risposta_min?.message}
                hint="Oltre questo tempo un lead nuovo diventa rosso e avvisiamo venditore e responsabile."
              >
                <Input id="sg-tempo" inputMode="numeric" aria-invalid={!!err.tempo_max_risposta_min} {...form.register("tempo_max_risposta_min")} />
              </Field>
              <Field
                label="Soglia di giacenza (giorni)"
                htmlFor="sg-giac"
                error={err.soglia_giacenza_giorni?.message}
                hint="Le auto in stock da più giorni vengono segnalate in rosso."
              >
                <Input id="sg-giac" inputMode="numeric" aria-invalid={!!err.soglia_giacenza_giorni} {...form.register("soglia_giacenza_giorni")} />
              </Field>
            </div>
            <Controller
              control={form.control}
              name="round_robin_attivo"
              render={({ field }) => (
                <Switch
                  id="sg-rr"
                  checked={field.value}
                  onChange={field.onChange}
                  label="Assegnazione automatica dei lead"
                  description="Ogni nuovo lead va al venditore con meno lead aperti."
                />
              )}
            />
          </fieldset>
          {isTitolare && (
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting && <Spinner />}
              Salva regole
            </Button>
          )}
        </form>
      </Section>

      <DecoderSection />

      <Section title="Ultime automazioni eseguite" bodyClassName="p-0">
        {log.isError ? (
          <div className="p-4">
            <ErrorState error={log.error} onRetry={() => void log.refetch()} />
          </div>
        ) : log.isLoading ? (
          <ListSkeleton rows={3} className="space-y-3 p-4" />
        ) : log.data?.length === 0 ? (
          <EmptyState art="fatto" compact title="Ancora nessuna automazione" text="Qui vedrai assegnazioni automatiche, avvisi e uso dell'AI." />
        ) : (
          <ul className="divide-y">
            {log.data?.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{TIPI_LOG[l.tipo] ?? l.tipo.replace(/_/g, " ")}</p>
                  <p className="text-sm text-muted-foreground">{dataOra(l.created_at)}</p>
                </div>
                <Badge tone={ESITI[l.esito].tone} size="sm">
                  {ESITI[l.esito].label}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
