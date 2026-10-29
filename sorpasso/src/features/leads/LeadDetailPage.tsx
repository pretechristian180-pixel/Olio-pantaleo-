import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Car, ExternalLink, FileText, Pencil, Phone, Trophy, UserRound } from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { InfoRow, Section } from "@/components/shared/Section";
import { ErrorState, PageLoader } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import AppuntamentoDialog from "@/features/agenda/AppuntamentoDialog";
import { useAppuntamentiLead, type AppuntamentoEsteso } from "@/features/agenda/api";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { dataBreve, dataOra, euro, km } from "@/lib/format";
import { FONTI, PIPELINE, STATI_APPUNTAMENTO, STATI_LEAD, STATI_PREVENTIVO, TEMPISTICHE, TIPI_APPUNTAMENTO, tonePunteggio } from "@/lib/labels";
import { apriDocumento } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queries";
import type { LeadView, StatoLead } from "@/types/db";
import { useCambiaStato, useLead, usePreventiviLead } from "./api";
import { ChiudiVenditaDialog, PersoDialog } from "./dialogs";
import { autoLead, nomeLead } from "./LeadCard";
import { AzioniRapide } from "./scheda/AzioniRapide";
import { DatiLeadDialog } from "./scheda/DatiLeadDialog";
import { PannelloAI } from "./scheda/PannelloAI";
import { ProvenienzaAnnuncio } from "./scheda/ProvenienzaAnnuncio";
import { ProssimaAzione } from "./scheda/ProssimaAzione";
import { Timeline } from "./scheda/Timeline";

export default function LeadDetailPage() {
  const { id } = useParams();
  const { data: lead, isLoading, error, refetch } = useLead(id);
  const { isAmministrazione } = useSessione();

  if (isLoading) return <PageLoader />;
  if (error || !lead) {
    const nonTrovato = (error as { code?: string } | null)?.code === "PGRST116" || !error;
    return (
      <div>
        <BackLink to="/lead" label="Lead" />
        {nonTrovato ? (
          <EmptyState
            art="ricerca"
            title="Lead non trovato"
            text="Potrebbe essere stato eliminato o assegnato a un altro venditore."
            action={
              <Button asChild>
                <Link to="/lead">Torna ai lead</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  const sola_lettura = isAmministrazione;
  const chiuso = lead.stato === "vinto" || lead.stato === "perso";

  return (
    <div>
      <BackLink to="/lead" label="Lead" />
      <Intestazione lead={lead} sola_lettura={sola_lettura} />

      <div className="mt-5 space-y-4">
        {lead.stato === "perso" && (
          <div className="rounded-lg border bg-muted px-4 py-3 text-[15px]">
            <span className="font-semibold">Perso:</span> {lead.motivo_perso}
          </div>
        )}
        {lead.stato === "vinto" && <BannerVinto leadId={lead.id} />}
        {!chiuso && <ProssimaAzione key={lead.id} lead={lead} sola_lettura={sola_lettura} />}
        {!sola_lettura && <AzioniRapide lead={lead} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <DatiLead lead={lead} sola_lettura={sola_lettura} />
          <Preventivi lead={lead} sola_lettura={sola_lettura} />
          <Appuntamenti leadId={lead.id} />
        </div>
        <div className="space-y-6">
          <PannelloAI lead={lead} sola_lettura={sola_lettura} />
          <Timeline leadId={lead.id} sola_lettura={sola_lettura} />
        </div>
      </div>
    </div>
  );
}

function Intestazione({ lead, sola_lettura }: { lead: LeadView; sola_lettura: boolean }) {
  const cambia = useCambiaStato();
  const [perso, setPerso] = useState(false);
  const [vinto, setVinto] = useState(false);

  async function onStato(s: StatoLead) {
    if (s === "perso") return setPerso(true);
    if (s === "vinto") return setVinto(true);
    try {
      await cambia.mutateAsync({ id: lead.id, stato: s });
      toast.success(`Fase aggiornata: ${STATI_LEAD[s].label}`);
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{nomeLead(lead)}</h1>
          <Badge tone={tonePunteggio(lead.punteggio)} dot={false} title="Punteggio: quanto è vicino all'acquisto">
            {lead.punteggio} punti
          </Badge>
          {lead.in_ritardo && <Badge tone="red">Da contattare subito</Badge>}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted-foreground">
          {lead.contatto_telefono && (
            <span className="flex items-center gap-1">
              <Phone className="size-4" aria-hidden /> {lead.contatto_telefono}
            </span>
          )}
          <span>{FONTI[lead.fonte]}</span>
          <ProvenienzaAnnuncio leadId={lead.id} />
          <span>Arrivato il {dataOra(lead.created_at)}</span>
          <span>Venditore: {lead.assegnato_nome ?? "nessuno"}</span>
        </p>
      </div>
      <div className="sm:w-56">
        <label htmlFor="lead-stato" className="mb-1 block text-sm font-medium text-muted-foreground">
          Fase
        </label>
        <Select
          id="lead-stato"
          value={lead.stato}
          disabled={sola_lettura || lead.stato === "vinto" || cambia.isPending}
          onChange={(e) => void onStato(e.target.value as StatoLead)}
        >
          {PIPELINE.map((s) => (
            <option key={s} value={s}>
              {STATI_LEAD[s].label}
            </option>
          ))}
        </Select>
      </div>
      <PersoDialog leadId={lead.id} open={perso} onOpenChange={setPerso} />
      <ChiudiVenditaDialog leadId={lead.id} vehicleId={lead.vehicle_id} prezzoProposto={lead.veicolo_prezzo} open={vinto} onOpenChange={setVinto} />
    </header>
  );
}

function BannerVinto({ leadId }: { leadId: string }) {
  const { data } = useQuery({
    queryKey: [...qk.pratiche, "da-lead", leadId],
    queryFn: async () => (await supabase.from("deals").select("id, avanzamento").eq("lead_id", leadId).maybeSingle()).data,
  });
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-success/30 bg-success-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 font-semibold text-success">
        <Trophy className="size-5" aria-hidden /> Vendita chiusa
        {data && <span className="font-normal text-foreground">· pratica al {data.avanzamento}%</span>}
      </p>
      {data && (
        <Button asChild variant="outline" size="sm">
          <Link to={`/pratiche/${data.id}`}>Apri la pratica</Link>
        </Button>
      )}
    </div>
  );
}

function DatiLead({ lead, sola_lettura }: { lead: LeadView; sola_lettura: boolean }) {
  const [modifica, setModifica] = useState(false);
  const p = lead.permuta_dati;
  return (
    <Section
      title="Cliente e richiesta"
      action={
        !sola_lettura && (
          <Button variant="ghost" size="sm" onClick={() => setModifica(true)}>
            <Pencil className="size-4" aria-hidden /> Modifica
          </Button>
        )
      }
    >
      <Link to={`/clienti/${lead.contact_id}`} className="mb-3 flex items-center gap-2 font-semibold text-accent hover:underline">
        <UserRound className="size-5" aria-hidden /> Scheda cliente
      </Link>
      {lead.vehicle_id ? (
        <Link to={`/stock/${lead.vehicle_id}`} className="mb-3 flex items-center justify-between gap-3 rounded-lg border p-3 hover:border-accent/50">
          <span className="flex items-center gap-2">
            <Car className="size-5 text-accent" aria-hidden />
            <span>
              <span className="block font-semibold">{autoLead(lead)}</span>
              {lead.veicolo_versione && <span className="block text-sm text-muted-foreground">{lead.veicolo_versione}</span>}
            </span>
          </span>
          <span className="font-semibold">{euro(lead.veicolo_prezzo)}</span>
        </Link>
      ) : null}
      <dl>
        {!lead.vehicle_id && <InfoRow label="Cerca">{autoLead(lead) ?? "Non indicato"}</InfoRow>}
        <InfoRow label="Budget">{euro(lead.budget)}</InfoRow>
        <InfoRow label="Tempistica">{TEMPISTICHE[lead.tempistica]}</InfoRow>
        <InfoRow label="Finanziamento">{lead.finanziamento ? "Sì" : "No"}</InfoRow>
        <InfoRow label="Permuta">
          {lead.permuta ? [p?.marca, p?.modello, p?.anno, p?.km != null ? km(p.km) : null].filter(Boolean).join(" · ") || "Sì" : "No"}
        </InfoRow>
        {lead.contatto_email && <InfoRow label="Email">{lead.contatto_email}</InfoRow>}
        <InfoRow label="Primo contatto">{lead.primo_contatto_at ? dataOra(lead.primo_contatto_at) : "Non ancora"}</InfoRow>
      </dl>
      {lead.richiesta && (
        <div className="mt-3 rounded-lg bg-muted p-3 text-[15px]">
          <p className="mb-1 text-sm font-medium text-muted-foreground">Richiesta</p>
          <p className="whitespace-pre-line">{lead.richiesta}</p>
        </div>
      )}
      {modifica && <DatiLeadDialog lead={lead} open={modifica} onOpenChange={setModifica} />}
    </Section>
  );
}

function Preventivi({ lead, sola_lettura }: { lead: LeadView; sola_lettura: boolean }) {
  const { data = [], isLoading } = usePreventiviLead(lead.id);
  const chiuso = lead.stato === "vinto" || lead.stato === "perso";
  return (
    <Section
      title="Preventivi"
      count={data.length}
      action={
        !sola_lettura &&
        !chiuso && (
          <Button asChild variant="ghost" size="sm">
            <Link to={`/lead/${lead.id}/preventivo`}>
              <FileText className="size-4" aria-hidden /> Nuovo
            </Link>
          </Button>
        )
      }
    >
      {isLoading ? null : data.length === 0 ? (
        <p className="text-muted-foreground">Nessun preventivo. Un preventivo chiaro accorcia la trattativa.</p>
      ) : (
        <ul className="divide-y">
          {data.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="font-semibold">{euro(q.totale)}</p>
                <p className="text-sm text-muted-foreground">
                  {dataBreve(q.created_at)}
                  {q.finanziamento && q.rata ? ` · rata ${euro(q.rata)} × ${q.durata_mesi}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATI_PREVENTIVO[q.stato].tone} size="sm">
                  {STATI_PREVENTIVO[q.stato].label}
                </Badge>
                {q.pdf_path && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Apri PDF"
                    onClick={() => apriDocumento(q.pdf_path!).catch((e) => mostraErrore(e))}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Appuntamenti({ leadId }: { leadId: string }) {
  const { data = [] } = useAppuntamentiLead(leadId);
  const [aperto, setAperto] = useState<AppuntamentoEsteso | null>(null);
  return (
    <Section title="Appuntamenti" count={data.length}>
      {data.length === 0 ? (
        <p className="text-muted-foreground">Nessun appuntamento. Un test drive aumenta molto le probabilità di vendita.</p>
      ) : (
        <ul className="divide-y">
          {data.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setAperto(a)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-5 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="block font-medium">{TIPI_APPUNTAMENTO[a.tipo].label}</span>
                    <span className="block text-sm text-muted-foreground">
                      {dataOra(a.inizio)}
                      {a.vehicles ? ` · ${a.vehicles.marca} ${a.vehicles.modello}` : ""}
                    </span>
                  </span>
                </span>
                <Badge tone={a.stato === "completato" ? "green" : a.stato === "programmato" ? "blue" : "gray"} size="sm">
                  {STATI_APPUNTAMENTO[a.stato]}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aperto && <AppuntamentoDialog open onOpenChange={(v) => !v && setAperto(null)} appuntamento={aperto} />}
    </Section>
  );
}
