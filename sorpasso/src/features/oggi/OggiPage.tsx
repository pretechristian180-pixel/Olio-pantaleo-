import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Car, CheckCircle2, Clock, MessageCircle, Phone, Plus, Target, Timer, TrendingUp, Trophy, Warehouse } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Section } from "@/components/shared/Section";
import { StatCard } from "@/components/shared/StatCard";
import { ErrorState, ListSkeleton } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppuntamenti, clienteAppuntamento } from "@/features/agenda/api";
import AppuntamentoDialog from "@/features/agenda/AppuntamentoDialog";
import type { AppuntamentoEsteso } from "@/features/agenda/api";
import { useAggiungiAttivita } from "@/features/leads/api";
import { autoLead, minutiAttesa, nomeLead } from "@/features/leads/LeadCard";
import NuovoLeadDialog from "@/features/leads/NuovoLeadDialog";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { addDays, dataLunga, durata, euro, numero, ora, relativo, startOfDay } from "@/lib/format";
import { FONTI, TIPI_APPUNTAMENTO, toneClasses } from "@/lib/labels";
import { compilaTemplate, linkTelefono, linkWhatsApp } from "@/lib/messaggi";
import { useTemplates } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { LeadView, VehicleView } from "@/types/db";
import { useKpiMese, useOggi } from "./api";

function saluto() {
  const h = new Date().getHours();
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

export default function OggiPage() {
  const { profilo, isManager, isAmministrazione } = useSessione();
  const [nuovo, setNuovo] = useState(false);
  const oggi = useOggi();
  const oggiInizio = startOfDay();
  const appuntamenti = useAppuntamenti(oggiInizio, addDays(oggiInizio, 1));

  const d = oggi.data;
  const daFare = d ? d.daContattare.length + d.senzaAzione.length + d.followUp.length : 0;
  const inRitardo = d?.daContattare.filter((l) => l.in_ritardo).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[15px] capitalize text-muted-foreground">{dataLunga(new Date())}</p>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">
            {saluto()}, {profilo.nome.split(" ")[0]}
          </h1>
          {d && !isAmministrazione && (
            <p className="mt-1 text-[17px] text-muted-foreground">
              {daFare === 0 ? (
                "Nessuna urgenza: ottimo momento per richiamare i clienti caldi."
              ) : (
                <>
                  Hai <strong className="text-foreground">{daFare}</strong> {daFare === 1 ? "cosa" : "cose"} da fare oggi
                  {inRitardo > 0 && (
                    <>
                      , di cui <strong className="text-destructive">{inRitardo} in ritardo</strong>
                    </>
                  )}
                  .
                </>
              )}
            </p>
          )}
        </div>
        {!isAmministrazione && (
          <Button variant="accent" size="lg" onClick={() => setNuovo(true)} className="w-full sm:w-auto">
            <Plus aria-hidden /> Nuovo lead
          </Button>
        )}
      </div>

      {isManager && <Kpi />}

      {oggi.error ? (
        <ErrorState error={oggi.error} onRetry={() => void oggi.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {!isAmministrazione && (
            <>
              <DaContattare leads={d?.daContattare} caricamento={oggi.isLoading} onNuovo={() => setNuovo(true)} mostraVenditore={isManager} />
              <FollowUp leads={d?.followUp} caricamento={oggi.isLoading} mostraVenditore={isManager} />
              <SenzaAzione leads={d?.senzaAzione} caricamento={oggi.isLoading} mostraVenditore={isManager} />
            </>
          )}
          <AppuntamentiOggi dati={appuntamenti.data} caricamento={appuntamenti.isLoading} />
          <AutoFerme veicoli={d?.ferme} caricamento={oggi.isLoading} />
        </div>
      )}

      {nuovo && <NuovoLeadDialog open={nuovo} onOpenChange={setNuovo} />}
    </div>
  );
}

/* ---------- KPI del mese ---------- */

function Kpi() {
  const { data, isLoading, error } = useKpiMese(true);
  if (error) return null;
  if (isLoading || !data)
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  const fonti = data.per_fonte.slice(0, 4);
  const maxFonte = Math.max(1, ...fonti.map((f) => f.lead));
  return (
    <section aria-label="Numeri del mese">
      <h2 className="mb-3 text-lg font-semibold">Questo mese</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard value={numero(data.lead_ricevuti)} label="Lead ricevuti" icon={<Target />} tone="accent" to="/lead?vista=tabella" />
        <StatCard value={`${numero(data.tasso_conversione)}%`} label="Conversione" hint={`${data.lead_vinti} vinti`} icon={<TrendingUp />} tone="green" />
        <StatCard value={numero(data.auto_vendute)} label="Auto vendute" hint={euro(data.fatturato)} icon={<Trophy />} tone="green" to="/pratiche" />
        <StatCard
          value={durata(data.tempo_medio_risposta_min)}
          label="Tempo medio prima risposta"
          icon={<Timer />}
          tone={data.tempo_medio_risposta_min != null && data.tempo_medio_risposta_min > 60 ? "red" : "blue"}
        />
        <StatCard value={data.giacenza_media_giorni != null ? `${data.giacenza_media_giorni} gg` : "—"} label="Giacenza media stock" icon={<Warehouse />} tone="yellow" to="/stock" />
      </div>
      {fonti.length > 0 && (
        <div className="mt-3 rounded-lg border bg-card p-4 shadow-card">
          <p className="mb-3 text-[15px] font-medium text-muted-foreground">Lead per fonte</p>
          <ul className="space-y-2">
            {fonti.map((f) => (
              <li key={f.fonte} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[15px]">
                <span className="truncate">{FONTI[f.fonte]}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(f.lead / maxFonte) * 100}%` }} />
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {f.lead} · {f.conversione}%
                </span>
              </li>
            ))}
          </ul>
          <Link to="/report" className="mt-3 inline-block text-[15px] font-medium text-accent hover:underline">
            Vedi tutti i report
          </Link>
        </div>
      )}
    </section>
  );
}

/* ---------- Liste ---------- */

function DaContattare({
  leads,
  caricamento,
  onNuovo,
  mostraVenditore,
}: {
  leads?: LeadView[];
  caricamento: boolean;
  onNuovo: () => void;
  mostraVenditore: boolean;
}) {
  const ritardo = leads?.filter((l) => l.in_ritardo).length ?? 0;
  return (
    <Section
      title="Da contattare subito"
      count={leads?.length}
      tone={ritardo > 0 ? "red" : "default"}
      className="lg:col-span-2"
      bodyClassName="p-0 sm:p-0"
    >
      {caricamento ? (
        <ListSkeleton rows={2} className="space-y-3 p-4" />
      ) : !leads?.length ? (
        <EmptyState
          compact
          art="fatto"
          title="Nessun lead in attesa, ottimo lavoro"
          text="Tutti i nuovi contatti hanno ricevuto risposta."
          action={
            <Button variant="outline" onClick={onNuovo}>
              <Plus aria-hidden /> Inserisci un lead
            </Button>
          }
        />
      ) : (
        <ul className="divide-y">
          {leads.map((l) => (
            <RigaDaContattare key={l.id} lead={l} mostraVenditore={mostraVenditore} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function RigaDaContattare({ lead, mostraVenditore }: { lead: LeadView; mostraVenditore: boolean }) {
  const { profilo, organizzazione } = useSessione();
  const aggiungi = useAggiungiAttivita();
  const templates = useTemplates("whatsapp");
  const attesa = minutiAttesa(lead);
  const auto = autoLead(lead);

  // Il primo template WhatsApp ("Primo contatto") precompila il messaggio.
  const testoWa = templates.data?.[0]
    ? compilaTemplate(templates.data[0].testo, {
        nome: lead.contatto_nome,
        cognome: lead.contatto_cognome,
        auto: auto ?? "",
        venditore: profilo.nome,
        azienda: organizzazione.nome,
      })
    : `Buongiorno ${lead.contatto_nome}, sono ${profilo.nome} di ${organizzazione.nome}. Ho ricevuto la sua richiesta: quando possiamo sentirci?`;

  async function registra(tipo: "chiamata" | "whatsapp", contenuto: string) {
    try {
      await aggiungi.mutateAsync({ lead_id: lead.id, tipo, contenuto });
      toast.success("Contatto registrato", { description: "Ricorda di fissare la prossima azione." });
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <li className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5", lead.in_ritardo && "bg-destructive-soft/50")}>
      <Link to={`/lead/${lead.id}`} className="min-w-0 flex-1">
        <p className="font-semibold">{nomeLead(lead)}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[auto, FONTI[lead.fonte], mostraVenditore ? (lead.assegnato_nome ?? "Non assegnato") : null].filter(Boolean).join(" · ")}
        </p>
        <p className={cn("mt-0.5 flex items-center gap-1 text-sm", lead.in_ritardo ? "font-semibold text-destructive" : "text-muted-foreground")}>
          <Clock className="size-4" aria-hidden />
          {lead.in_ritardo ? `In attesa da ${durata(attesa)} (max ${lead.tempo_max_risposta_min} min)` : `Arrivato ${relativo(lead.created_at)}`}
        </p>
      </Link>
      {lead.contatto_telefono && (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button asChild variant="accent" size="sm">
            <a href={linkTelefono(lead.contatto_telefono)} onClick={() => void registra("chiamata", "Chiamata avviata dalla schermata Oggi")}>
              <Phone className="size-4" aria-hidden /> Chiama
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="text-[#128C7E]">
            <a
              href={linkWhatsApp(lead.contatto_telefono, testoWa)}
              target="_blank"
              rel="noopener"
              onClick={() => void registra("whatsapp", testoWa)}
            >
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </a>
          </Button>
        </div>
      )}
    </li>
  );
}

function RigaLead({ lead, dettaglio, mostraVenditore }: { lead: LeadView; dettaglio: ReactNode; mostraVenditore: boolean }) {
  return (
    <li>
      <Link to={`/lead/${lead.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 sm:px-5">
        <span className="min-w-0">
          <span className="block font-semibold">{nomeLead(lead)}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {[autoLead(lead), mostraVenditore ? lead.assegnato_nome : null].filter(Boolean).join(" · ") || FONTI[lead.fonte]}
          </span>
        </span>
        <span className="shrink-0 text-right text-sm">{dettaglio}</span>
      </Link>
    </li>
  );
}

function FollowUp({ leads, caricamento, mostraVenditore }: { leads?: LeadView[]; caricamento: boolean; mostraVenditore: boolean }) {
  const ora_ = new Date();
  const scaduti = leads?.filter((l) => new Date(l.prossima_azione_at!) < ora_).length ?? 0;
  return (
    <Section title="Follow-up di oggi" count={leads?.length} tone={scaduti > 0 ? "red" : "default"} bodyClassName="p-0 sm:p-0">
      {caricamento ? (
        <ListSkeleton rows={3} className="space-y-3 p-4" />
      ) : !leads?.length ? (
        <EmptyState compact art="fatto" title="Nessun follow-up in scadenza" text="I prossimi richiami sono già pianificati." />
      ) : (
        <ul className="divide-y">
          {leads.map((l) => {
            const scaduto = new Date(l.prossima_azione_at!) < ora_;
            return (
              <RigaLead
                key={l.id}
                lead={l}
                mostraVenditore={mostraVenditore}
                dettaglio={
                  <>
                    <span className={cn("block font-semibold", scaduto ? "text-destructive" : "text-foreground")}>
                      {scaduto ? `Scaduto ${relativo(l.prossima_azione_at)}` : `alle ${ora(l.prossima_azione_at!)}`}
                    </span>
                    <span className="block max-w-40 truncate text-muted-foreground">{l.prossima_azione_nota}</span>
                  </>
                }
              />
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function SenzaAzione({ leads, caricamento, mostraVenditore }: { leads?: LeadView[]; caricamento: boolean; mostraVenditore: boolean }) {
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-warning" aria-hidden /> Da gestire
        </span>
      }
      count={leads?.length}
      bodyClassName="p-0 sm:p-0"
    >
      {caricamento ? (
        <ListSkeleton rows={2} className="space-y-3 p-4" />
      ) : !leads?.length ? (
        <EmptyState compact art="fatto" title="Ogni lead ha la sua prossima azione" text="Nessun cliente è stato dimenticato." />
      ) : (
        <>
          <p className="px-4 pt-3 text-sm text-muted-foreground sm:px-5">Lead aperti senza prossima azione: decidi cosa fare e quando.</p>
          <ul className="divide-y">
            {leads.map((l) => (
              <RigaLead
                key={l.id}
                lead={l}
                mostraVenditore={mostraVenditore}
                dettaglio={<span className="font-medium text-warning">Pianifica</span>}
              />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function AppuntamentiOggi({ dati, caricamento }: { dati?: AppuntamentoEsteso[]; caricamento: boolean }) {
  const [aperto, setAperto] = useState<AppuntamentoEsteso | null>(null);
  const attivi = dati?.filter((a) => a.stato !== "annullato");
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <CalendarDays className="size-5 text-accent" aria-hidden /> Appuntamenti di oggi
        </span>
      }
      count={attivi?.length}
      action={
        <Link to="/agenda" className="text-[15px] font-medium text-accent hover:underline">
          Agenda
        </Link>
      }
      bodyClassName="p-0 sm:p-0"
    >
      {caricamento ? (
        <ListSkeleton rows={2} className="space-y-3 p-4" />
      ) : !attivi?.length ? (
        <EmptyState compact art="calendario" title="Nessun appuntamento oggi" text="Un test drive è il modo più rapido per chiudere: proponilo ai lead caldi." />
      ) : (
        <ul className="divide-y">
          {attivi.map((a) => {
            const tipo = TIPI_APPUNTAMENTO[a.tipo];
            const passato = new Date(a.fine) < new Date();
            return (
              <li key={a.id}>
                <button type="button" onClick={() => setAperto(a)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 sm:px-5", passato && "opacity-60")}>
                  <span className="w-14 shrink-0 text-lg font-bold tabular-nums">{ora(a.inizio)}</span>
                  <span className={cn("h-10 w-1 shrink-0 rounded-full", toneClasses[tipo.tone].solid)} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{clienteAppuntamento(a) ?? tipo.label}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {tipo.label}
                      {a.vehicles ? ` · ${a.vehicles.marca} ${a.vehicles.modello}` : ""}
                    </span>
                  </span>
                  {a.stato === "completato" && <CheckCircle2 className="size-5 text-success" aria-label="Completato" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {aperto && <AppuntamentoDialog open onOpenChange={(v) => !v && setAperto(null)} appuntamento={aperto} />}
    </Section>
  );
}

function AutoFerme({ veicoli, caricamento }: { veicoli?: VehicleView[]; caricamento: boolean }) {
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Car className="size-5 text-warning" aria-hidden /> Auto ferme da troppo
        </span>
      }
      count={veicoli?.length}
      action={
        <Link to="/stock" className="text-[15px] font-medium text-accent hover:underline">
          Stock
        </Link>
      }
      bodyClassName="p-0 sm:p-0"
    >
      {caricamento ? (
        <ListSkeleton rows={2} className="space-y-3 p-4" />
      ) : !veicoli?.length ? (
        <EmptyState compact art="auto" title="Nessuna auto oltre la soglia di giacenza" text="Lo stock gira bene." />
      ) : (
        <>
          <p className="px-4 pt-3 text-sm text-muted-foreground sm:px-5">Valuta un ritocco di prezzo o proponile ai clienti compatibili.</p>
          <ul className="divide-y">
            {veicoli.map((v) => (
              <li key={v.id}>
                <Link to={`/stock/${v.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {v.marca} {v.modello}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {euro(v.prezzo_vendita)} · {v.lead_aperti} lead aperti
                    </span>
                  </span>
                  <Badge tone="red" size="sm">
                    {v.giorni_giacenza} giorni
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
