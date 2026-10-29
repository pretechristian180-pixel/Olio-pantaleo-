import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarPlus, Car, Check, Target, User } from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { InfoRow, Section } from "@/components/shared/Section";
import { ErrorState, PageLoader, Spinner } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import AppuntamentoDialog from "@/features/agenda/AppuntamentoDialog";
import { DocumentiSezione } from "@/features/clienti/Documenti";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { dataBreve, euro, nomeCompleto } from "@/lib/format";
import { CHECKLIST, STATI_VOCE, toneClasses } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ChecklistVoce, StatoVoce } from "@/types/db";
import { prossimaVoce, useAggiornaPratica, useAggiornaVoce, usePratica } from "./api";

const STATI: StatoVoce[] = ["da_fare", "in_corso", "fatto"];

export default function PraticaDetailPage() {
  const { id } = useParams();
  const { puo, isAmministrazione } = useSessione();
  const puoModificare = puo("titolare", "responsabile_vendite", "amministrazione");
  const pratica = usePratica(id);
  const aggiornaVoce = useAggiornaVoce();
  const aggiorna = useAggiornaPratica();
  const [consegna, setConsegna] = useState("");
  const [note, setNote] = useState("");
  const [fissaConsegna, setFissaConsegna] = useState(false);

  // Allinea i campi solo quando cambia il valore salvato (non a ogni ricaricamento).
  const consegnaSalvata = pratica.data?.data_consegna;
  const noteSalvate = pratica.data?.note;
  useEffect(() => setConsegna(consegnaSalvata ?? ""), [consegnaSalvata]);
  useEffect(() => setNote(noteSalvate ?? ""), [noteSalvate]);

  if (pratica.isLoading) return <PageLoader />;
  if (pratica.isError || !pratica.data)
    return (
      <>
        <BackLink to="/pratiche" label="Pratiche" />
        <ErrorState error={pratica.error} title="Pratica non trovata" onRetry={() => void pratica.refetch()} />
      </>
    );

  const d = pratica.data;
  const cliente = d.contacts ? nomeCompleto(d.contacts) : "Cliente";
  const auto = d.vehicles ? `${d.vehicles.marca} ${d.vehicles.modello}` : "Auto";
  const prossima = prossimaVoce(d);

  async function cambiaVoce(voce: ChecklistVoce, stato: StatoVoce) {
    try {
      await aggiornaVoce.mutateAsync({ id: d.id, voce, stato });
    } catch (e) {
      mostraErrore(e, "Non sono riuscito ad aggiornare la checklist.");
    }
  }

  async function salvaConsegna() {
    try {
      await aggiorna.mutateAsync({ id: d.id, data_consegna: consegna || null });
      toast.success(consegna ? `Consegna fissata al ${dataBreve(consegna)}` : "Data di consegna rimossa");
    } catch (e) {
      mostraErrore(e);
    }
  }

  async function salvaNote() {
    try {
      await aggiorna.mutateAsync({ id: d.id, note: note.trim() || null });
      toast.success("Note salvate");
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <>
      <BackLink to="/pratiche" label="Pratiche" />

      <div className="mb-6">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{cliente}</h1>
        <p className="mt-1 text-[17px] text-muted-foreground">
          {auto}
          {d.vehicles?.targa && ` · ${d.vehicles.targa}`} · venduta il {dataBreve(d.data_vendita)}
        </p>
      </div>

      <div className="mb-6 rounded-lg border bg-card p-5 shadow-card">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[15px] text-muted-foreground">Avanzamento pratica</p>
            <p className="text-4xl font-bold tabular-nums">{d.avanzamento}%</p>
          </div>
          {prossima ? (
            <Badge tone="yellow">Prossimo passo: {prossima.label}</Badge>
          ) : (
            <Badge tone="green">Pratica completa</Badge>
          )}
        </div>
        <Progress value={d.avanzamento} className="mt-4 h-3" tone={d.avanzamento >= 100 ? "bg-success" : "bg-accent"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Section title="Checklist" action={!puoModificare && <span className="text-sm text-muted-foreground">Sola lettura</span>}>
            <ul className="space-y-4">
              {CHECKLIST.map(({ voce, label }) => {
                const stato = d.checklist?.[voce] ?? "da_fare";
                return (
                  <li key={voce} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-2.5 text-[16px] font-medium">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full",
                          stato === "fatto" ? "bg-success text-white" : toneClasses[STATI_VOCE[stato].tone].soft,
                        )}
                        aria-hidden
                      >
                        {stato === "fatto" && <Check className="size-4" strokeWidth={3} />}
                      </span>
                      {label}
                    </span>
                    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-muted p-1 sm:w-[320px]">
                      {STATI.map((s) => {
                        const attivo = s === stato;
                        return (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={attivo}
                            disabled={!puoModificare || aggiornaVoce.isPending}
                            onClick={() => !attivo && void cambiaVoce(voce, s)}
                            className={cn(
                              "h-11 flex-1 rounded-md px-2 text-[15px] font-medium transition-colors disabled:cursor-not-allowed",
                              attivo
                                ? s === "fatto"
                                  ? "bg-success text-white shadow-card"
                                  : s === "in_corso"
                                    ? "bg-warning text-white shadow-card"
                                    : "bg-background text-foreground shadow-card"
                                : "text-muted-foreground hover:text-foreground",
                              !puoModificare && !attivo && "opacity-60",
                            )}
                          >
                            {STATI_VOCE[s].label}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>

          <DocumentiSezione rif={{ tipo: "pratica", id: d.id, contactId: d.contact_id }} />
        </div>

        <div className="space-y-5">
          <Section title="Vendita">
            <dl>
              <InfoRow label="Prezzo finale">{euro(d.prezzo_finale)}</InfoRow>
              <InfoRow label="Data vendita">{dataBreve(d.data_vendita)}</InfoRow>
              <InfoRow label="Venditore">{d.profiles?.nome}</InfoRow>
            </dl>
            <div className="mt-4 grid gap-2">
              <Button asChild variant="outline" className="justify-start">
                <Link to={`/clienti/${d.contact_id}`}>
                  <User aria-hidden /> Scheda cliente
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to={`/stock/${d.vehicle_id}`}>
                  <Car aria-hidden /> Scheda auto
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to={`/lead/${d.lead_id}`}>
                  <Target aria-hidden /> Storico del lead
                </Link>
              </Button>
            </div>
          </Section>

          <Section title="Consegna">
            <Field label="Data di consegna" htmlFor="pr-consegna">
              <Input
                id="pr-consegna"
                type="date"
                value={consegna}
                min={d.data_vendita}
                onChange={(e) => setConsegna(e.target.value)}
                disabled={!puoModificare}
              />
            </Field>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {puoModificare && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => void salvaConsegna()}
                  disabled={aggiorna.isPending || consegna === (d.data_consegna ?? "")}
                >
                  {aggiorna.isPending && <Spinner />}
                  Salva data
                </Button>
              )}
              {/* Gli appuntamenti appartengono ai venditori: l'amministrazione imposta solo la data. */}
              {!isAmministrazione && (
                <Button variant="accent" className="flex-1" onClick={() => setFissaConsegna(true)}>
                  <CalendarPlus aria-hidden /> Fissa in agenda
                </Button>
              )}
            </div>
          </Section>

          <Section title="Note">
            <Textarea
              aria-label="Note della pratica"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Es. finanziamento con banca X, targa da ritirare in agenzia"
              className="min-h-24"
              maxLength={2000}
              disabled={!puoModificare}
            />
            {puoModificare && (
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => void salvaNote()}
                disabled={aggiorna.isPending || note.trim() === (d.note ?? "")}
              >
                Salva note
              </Button>
            )}
          </Section>
        </div>
      </div>

      <AppuntamentoDialog
        open={fissaConsegna}
        onOpenChange={setFissaConsegna}
        iniziale={{
          tipo: "consegna",
          lead_id: d.lead_id,
          contact_id: d.contact_id,
          vehicle_id: d.vehicle_id,
          assegnato_a: d.venditore_id,
          inizio: d.data_consegna ? new Date(`${d.data_consegna}T10:00:00`) : undefined,
          cliente: `${cliente} · ${auto}`,
        }}
      />
    </>
  );
}
