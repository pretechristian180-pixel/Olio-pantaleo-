import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ChevronRight, Copy, Globe, Mail, Send, Share2, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { listTeam } from "@/services/api";
import { disconnectPage, getIntake, getLeadSettings, saveLeadSettings, sendTestLead, startMetaConnect } from "@/services/leads";
import type { LeadAssignment } from "@/types/leads";

const copy = (text: string, what: string) =>
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${what} copiato`))
    .catch(() => toast.error("Copia non riuscita"));

/** Impostazioni → Lead in arrivo (solo titolare): da dove arrivano e a chi vanno */
export function LeadSettingsPage() {
  const { isOwner } = useAuth();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const esito = params.get("meta");
    if (!esito) return;
    if (esito === "ok") toast.success("Facebook e Instagram collegati", { description: "I nuovi lead delle tue inserzioni arriveranno da soli." });
    else if (esito === "nessuna_pagina") toast.error("Nessuna pagina collegata", { description: "Scegli almeno una pagina Facebook di cui sei amministratore." });
    else if (esito !== "annullato") toast.error("Collegamento non riuscito", { description: "Riprova tra qualche minuto." });
    setParams({}, { replace: true });
  }, [params, setParams]);

  if (!isOwner)
    return (
      <div className="mx-auto max-w-3xl">
        <BackLink to="/impostazioni" label="Impostazioni" />
        <EmptyState art="persone" title="Solo il titolare gestisce i lead in arrivo" text="I lead assegnati a te li trovi in Contatti → Lead." />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink to="/impostazioni" label="Impostazioni" />
      <PageHeader title="Lead in arrivo" subtitle="Tutte le richieste in un'unica casella, assegnate e con il punteggio" />
      <TestCard />
      <AssignmentCard />
      <SourcesCard />
      <Link to="/impostazioni/automazioni" className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-card hover:border-primary/40">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
          <Zap className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold">Risposta automatica e allarme</span>
          <span className="block text-muted-foreground">Messaggio subito a ogni lead e avviso a te se nessuno lo richiama entro 2 ore lavorative</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}

function TestCard() {
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center">
        <p className="flex-1 text-[17px]">Vuoi vedere come funziona? Manda un lead di prova: arriva nella casella, con punteggio, agente e promemoria.</p>
        <Button
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await sendTestLead();
              toast.success("Lead di prova arrivato", { description: "Lo trovi in Contatti → Lead." });
            } catch (e) {
              toast.error("Non inviato", { description: friendlyError(e) });
            }
            setBusy(false);
          }}
        >
          <Send aria-hidden />
          {busy ? "Invio…" : "Manda un lead di prova"}
        </Button>
      </CardContent>
    </Card>
  );
}

const assignOptions: { id: LeadAssignment; label: string; hint: string }[] = [
  { id: "agente_immobile", label: "All'agente dell'immobile", hint: "Se il lead chiede di un immobile va a chi lo segue; gli altri a turno" },
  { id: "rotazione", label: "A turno tra gli agenti", hint: "Uno a testa, nell'ordine" },
  { id: "titolare", label: "Sempre a me", hint: "Poi li smisti tu dalla scheda del lead" },
];

function AssignmentCard() {
  const { data, loading } = useQuery(getLeadSettings);
  const team = useQuery(listTeam);
  const [mode, setMode] = useState<LeadAssignment | null>(null);
  const [rotation, setRotation] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const members = (team.data?.members ?? []).filter((m) => m.active);
  const current = mode ?? data?.assignment ?? "agente_immobile";
  const rot = rotation ?? data?.rotation ?? [];
  const changed = mode !== null || rotation !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-primary" aria-hidden />A chi vanno i lead
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <p className="text-[15px] text-muted-foreground">Un cliente che segui già resta sempre al suo agente.</p>
            <div className="space-y-2" role="radiogroup" aria-label="Assegnazione">
              {assignOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={current === o.id}
                  onClick={() => setMode(o.id)}
                  className={cn("flex min-h-12 w-full flex-col rounded-lg border px-4 py-2 text-left", current === o.id ? "border-primary bg-primary-soft text-primary-strong" : "bg-card")}
                >
                  <span className="text-[17px] font-semibold">{o.label}</span>
                  <span className="text-[15px] text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
            {current !== "titolare" && members.length > 1 && (
              <fieldset>
                <legend className="mb-2 text-[15px] font-medium">Chi partecipa ai turni (nessuno scelto = tutti)</legend>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const on = rot.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setRotation(on ? rot.filter((x) => x !== m.id) : [...rot, m.id])}
                        className={cn("inline-flex h-12 items-center gap-2 rounded-full border px-4 text-[15px] font-medium", on ? "border-primary bg-primary text-white" : "bg-card")}
                      >
                        {on && <Check className="size-4" aria-hidden />}
                        {m.firstName} {m.lastName}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {changed && (
              <Button
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await saveLeadSettings(current, rot);
                    toast.success("Salvato");
                    setMode(null);
                    setRotation(null);
                  } catch (e) {
                    toast.error("Non salvato", { description: friendlyError(e) });
                  }
                  setBusy(false);
                }}
              >
                {busy ? "Salvo…" : "Salva"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SourcesCard() {
  const intake = useQuery(getIntake);
  const settings = useQuery(getLeadSettings);
  const [busy, setBusy] = useState(false);
  const i = intake.data;
  const form = i?.token
    ? `<form action="${i.formUrl}" method="post">
  <input type="hidden" name="token" value="${i.token}">
  <input type="hidden" name="ritorno" value="https://www.tuosito.it/grazie">
  <input type="text" name="sito_web" style="display:none" tabindex="-1" autocomplete="off">
  <label>Nome e cognome <input name="nome_completo" required></label>
  <label>Telefono <input name="telefono" type="tel"></label>
  <label>Email <input name="email" type="email"></label>
  <label>Messaggio <textarea name="messaggio"></textarea></label>
  <label><input type="checkbox" name="privacy" required> Ho letto l'informativa privacy</label>
  <button type="submit">Invia</button>
</form>`
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Da dove arrivano</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {intake.loading ? (
          <Skeleton className="h-48 w-full" />
        ) : intake.error || !i ? (
          <p className="text-muted-foreground">Non riesco a leggere la configurazione: riprova tra poco.</p>
        ) : (
          <>
            <Source icon={<Globe />} title="Modulo del sito" state={i.token ? "Pronto" : "Da attivare"} ready={!!i.token}>
              <p className="text-[15px]">Dai questo modulo a chi cura il tuo sito: le richieste arrivano qui in automatico. Sulle pagine degli immobili si può aggiungere il campo nascosto "riferimento" con l'indirizzo.</p>
              <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">{form}</pre>
              <Button variant="outline" onClick={() => copy(form, "Codice del modulo")}>
                <Copy aria-hidden />
                Copia il codice del modulo
              </Button>
            </Source>

            <Source icon={<Mail />} title="Email dei portali" state={i.email ? "Pronta" : "Da attivare"} ready={!!i.email}>
              {i.email ? (
                <>
                  <p className="text-[15px]">
                    Su Immobiliare.it, Idealista e Casa.it imposta questo indirizzo come email per le richieste (oppure inoltra lì le loro email). Leggiamo nome, telefono e messaggio
                    {i.aiEmail ? " con l'AI" : ""} e creiamo il lead.
                  </p>
                  <p className="break-all rounded-lg bg-muted px-3 py-2 font-medium">{i.email}</p>
                  <Button variant="outline" onClick={() => copy(i.email!, "Indirizzo")}>
                    <Copy aria-hidden />
                    Copia l'indirizzo
                  </Button>
                </>
              ) : (
                <p className="text-[15px] text-muted-foreground">Si attiva quando chi gestisce Mattonio collega il servizio di posta in arrivo.</p>
              )}
            </Source>

            <Source icon={<Share2 />} title="Facebook e Instagram" state={settings.data?.pages.length ? "Collegati" : i.metaReady ? "Da collegare" : "Da attivare"} ready={!!settings.data?.pages.length}>
              <p className="text-[15px]">I contatti delle tue inserzioni con modulo (Lead Ads) arrivano qui da soli, tramite il collegamento ufficiale di Meta.</p>
              {settings.data?.pages.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                  <span className="flex-1 font-medium">
                    {p.name}
                    {p.instagram ? " + Instagram" : ""}
                  </span>
                  {p.state === "da_ricollegare" && <Badge tone="orange">Da ricollegare</Badge>}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (!window.confirm(`Scollegare ${p.name}? I nuovi lead di questa pagina non arriveranno più.`)) return;
                      disconnectPage(p.id).then(() => toast.success("Pagina scollegata"));
                    }}
                  >
                    Scollega
                  </Button>
                </div>
              ))}
              {i.metaReady ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      window.location.href = await startMetaConnect();
                    } catch (e) {
                      toast.error("Non disponibile", { description: friendlyError(e) });
                      setBusy(false);
                    }
                  }}
                >
                  <Share2 aria-hidden />
                  {settings.data?.pages.length ? "Collega altre pagine" : "Collega Facebook e Instagram"}
                </Button>
              ) : (
                <p className="text-[15px] text-muted-foreground">Si attiva quando chi gestisce Mattonio configura l'app Meta.</p>
              )}
            </Source>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Source({ icon, title, state, ready, children }: { icon: React.ReactNode; title: string; state: string; ready: boolean; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-strong [&_svg]:size-5">{icon}</span>
        <h3 className="flex-1 text-[17px] font-semibold">{title}</h3>
        <Badge tone={ready ? "green" : "gray"}>{state}</Badge>
      </div>
      {children}
    </section>
  );
}
