import { useState } from "react";
import { ChevronRight, Mail, MessageCircle, Plus, RefreshCw, Settings2, SquareCheckBig, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatRelative, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getMessagingSettings,
  listAutomations,
  listOptOuts,
  listRuns,
  removeOptOut,
  saveMessagingSettings,
  setAutomationActive,
  syncTemplates,
} from "@/services/automations";
import type { Automation, RunState } from "@/types/automations";
import { AutomationEditor } from "./AutomationEditor";
import { NewAutomationWizard } from "./NewAutomationWizard";
import { runState, templateState, whenText } from "./labels";

type Vista = "ricette" | "cronologia" | "esclusi";

/** Impostazioni → Automazioni: ricette pronte già attive, cronologia, contatti esclusi */
export function AutomationsPage() {
  const { isOwner } = useAuth();
  const [vista, setVista] = useState<Vista>(isOwner ? "ricette" : "cronologia");
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to="/impostazioni" label="Impostazioni" />
      <PageHeader
        title="Automazioni"
        subtitle="Lavorano da sole: tu scegli solo cosa tenere acceso"
        action={
          isOwner && vista === "ricette" ? (
            <Button size="lg" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              Crea automazione
            </Button>
          ) : undefined
        }
      />
      <Segmented
        label="Sezione"
        value={vista}
        onChange={setVista}
        className="mb-6"
        options={[
          ...(isOwner ? [{ value: "ricette" as const, label: "Ricette" }] : []),
          { value: "cronologia" as const, label: "Cronologia" },
          { value: "esclusi" as const, label: "Esclusi" },
        ]}
      />
      {vista === "ricette" && <Recipes />}
      {vista === "cronologia" && <History />}
      {vista === "esclusi" && <OptOuts />}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent title="Nuova automazione" description="Tre passi: quando, quanto aspettare, cosa fare.">
          {creating && <NewAutomationWizard onDone={() => setCreating(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Ricette ---------- */

function Recipes() {
  const { data, loading, error, reload } = useQuery(listAutomations);
  const channels = useQuery(getMessagingSettings);
  const [editing, setEditing] = useState<Automation | null>(null);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data)
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  const active = data.filter((a) => a.active).length;
  return (
    <div className="space-y-4">
      <ChannelsCard />
      <p className="text-[15px] text-muted-foreground">
        {active} automazioni accese su {data.length}. Nessun messaggio parte tra le 21 e le 8:30 né la domenica, e mai più di uno al giorno
        per cliente.
      </p>
      {data.map((a) => (
        <RecipeCard key={a.id} automation={a} onOpen={() => setEditing(a)} reviewsLink={channels.data?.reviewsLink ?? ""} />
      ))}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing?.name ?? ""} description={editing?.description || (editing ? whenText(editing) : undefined)}>
          {editing && <AutomationEditor automation={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const actionIcon = { whatsapp: MessageCircle, email: Mail, task: SquareCheckBig, notifica_interna: BellRing, evento_agenda: SquareCheckBig, cambio_temperatura: Settings2 };

function RecipeCard({ automation: a, onOpen, reviewsLink }: { automation: Automation; onOpen: () => void; reviewsLink: string }) {
  const [busy, setBusy] = useState(false);
  const Icon = actionIcon[a.action];
  async function toggle() {
    if (!a.active && a.recipe === "dopo_rogito" && !reviewsLink) {
      toast.error("Prima aggiungi il link delle recensioni", { description: "Lo inserisci in Canali → Impostazioni." });
      return;
    }
    setBusy(true);
    try {
      await setAutomationActive(a.id, !a.active);
      toast.success(a.active ? "Automazione spenta" : "Automazione accesa", { description: a.name });
    } catch (err) {
      toast.error("Non salvato", { description: friendlyError(err) });
    }
    setBusy(false);
  }
  return (
    <div className={cn("rounded-lg border bg-card shadow-card", !a.active && "bg-card/60")}>
      <div className="flex items-start gap-3 p-4">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", a.active ? "bg-primary-soft text-primary-strong" : "bg-muted text-muted-foreground")}>
          <Icon className="size-5" aria-hidden />
        </span>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block text-[17px] font-semibold leading-snug">{a.name}</span>
          <span className="mt-1 block text-[15px] text-muted-foreground">{a.description || whenText(a)}</span>
        </button>
        <Switch on={a.active} onChange={toggle} disabled={busy} label={a.name} />
      </div>
      <button type="button" onClick={onOpen} className="flex w-full flex-wrap items-center gap-2 border-t px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/50">
        <span>{a.runsThisMonth === 1 ? "Eseguita 1 volta questo mese" : `Eseguita ${a.runsThisMonth} volte questo mese`}</span>
        {a.action === "whatsapp" && a.template && (
          <Badge tone={templateState[a.template.waState].tone} className="px-2 py-0.5 text-[12px]">
            {templateState[a.template.waState].label}
          </Badge>
        )}
        {a.needsConsent && <span>· solo con consenso</span>}
        <span className="ml-auto flex items-center gap-1 font-semibold text-primary-strong">
          Modifica
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </button>
    </div>
  );
}

function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${on ? "Spegni" : "Accendi"}: ${label}`}
      onClick={onChange}
      disabled={disabled}
      className="flex shrink-0 flex-col items-center gap-1"
    >
      <span className={cn("flex h-8 w-14 items-center rounded-full p-1 transition-colors", on ? "bg-success" : "bg-border")}>
        <span className={cn("size-6 rounded-full bg-white shadow transition-transform", on && "translate-x-6")} />
      </span>
      <span className={cn("text-[13px] font-semibold", on ? "text-success" : "text-muted-foreground")}>{on ? "Accesa" : "Spenta"}</span>
    </button>
  );
}

function ChannelsCard() {
  const { data, loading } = useQuery(getMessagingSettings);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (loading || !data) return <Skeleton className="h-20" />;
  const missingReviews = !data.reviewsLink;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Canali</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Settings2 aria-hidden />
          Impostazioni
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pt-1 text-[15px]">
        <p>
          <span className="font-semibold">WhatsApp:</span>{" "}
          {data.whatsappPhoneNumberId ? "numero collegato" : "non ancora collegato: i messaggi diventano email o cose da fare per l'agente"}
        </p>
        <p>
          <span className="font-semibold">Risposte alle email:</span> {data.replyEmail || "all'email dell'agenzia"}
        </p>
        {missingReviews && <p className="text-warning">Aggiungi il link delle recensioni Google per attivare "Dopo il rogito chiediamo una recensione".</p>}
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const n = await syncTemplates();
              toast.success("Stato dei modelli aggiornato", { description: `${n} modelli controllati su Meta` });
            } catch (err) {
              toast.error("Non aggiornato", { description: friendlyError(err) });
            }
            setBusy(false);
          }}
        >
          <RefreshCw aria-hidden className={cn(busy && "animate-spin")} />
          Aggiorna lo stato dei modelli WhatsApp
        </Button>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Impostazioni dei canali">
          {open && <ChannelsForm initial={data} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ChannelsForm({ initial, onDone }: { initial: Awaited<ReturnType<typeof getMessagingSettings>>; onDone: () => void }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.reviewsLink && !/^https:\/\//.test(f.reviewsLink.trim())) return toast.error("Il link delle recensioni deve iniziare con https://");
    setBusy(true);
    try {
      await saveMessagingSettings(f);
      toast.success("Canali salvati");
      onDone();
    } catch (err) {
      toast.error("Non salvato", { description: friendlyError(err) });
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Link delle recensioni Google" htmlFor="ch-rev" hint="Da Google Business Profile → Chiedi recensioni">
        <Input id="ch-rev" inputMode="url" value={f.reviewsLink} onChange={(e) => setF((x) => ({ ...x, reviewsLink: e.target.value }))} placeholder="https://g.page/r/…" />
      </Field>
      <Field label="Email per le risposte dei clienti" htmlFor="ch-mail">
        <Input id="ch-mail" type="email" value={f.replyEmail} onChange={(e) => setF((x) => ({ ...x, replyEmail: e.target.value }))} />
      </Field>
      <Field label="ID del numero WhatsApp (da Meta)" htmlFor="ch-wa" hint="Lo trovi in Meta for Developers → WhatsApp → Configurazione API. Te lo comunichiamo noi al collegamento.">
        <Input id="ch-wa" value={f.whatsappPhoneNumberId} onChange={(e) => setF((x) => ({ ...x, whatsappPhoneNumberId: e.target.value }))} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Salvataggio…" : "Salva"}
      </Button>
    </form>
  );
}

/* ---------- Cronologia ---------- */

function History() {
  const [filter, setFilter] = useState<RunState | "tutte">("tutte");
  const { data, loading, error, reload } = useQuery(() => listRuns(filter === "tutte" ? undefined : filter), [filter]);
  return (
    <div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 scrollbar-none" role="group" aria-label="Filtra">
        {(["tutte", "eseguita", "in_attesa", "saltata", "annullata"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
            className={cn("h-10 shrink-0 rounded-full border px-4 text-[15px] font-medium", filter === s ? "border-primary bg-primary text-white" : "bg-card text-foreground/80")}
          >
            {s === "tutte" ? "Tutte" : runState[s].label}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton className="h-60" />
      ) : data.length === 0 ? (
        <EmptyState art="calendario" title="Ancora niente qui" text="Quando un'automazione lavora, la trovi in questo elenco." className="rounded-lg border" />
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-card">
          {data.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={runState[r.state].tone} className="px-2 py-0.5 text-[12px]">
                  {runState[r.state].label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatRelative(r.doneAt ?? r.runAt)} alle {formatTime(r.doneAt ?? r.runAt)}
                  {r.channel && ` · ${r.channel === "task" ? "cosa da fare" : r.channel}`}
                </span>
              </div>
              <p className="mt-1 font-medium">{r.automationName}</p>
              {r.contactName && <p className="text-[15px] text-muted-foreground">{r.contactName}</p>}
              {r.reason && <p className="text-sm text-foreground/80">{r.reason}</p>}
              {r.text && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">“{r.text}”</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Contatti esclusi ---------- */

function OptOuts() {
  const { isOwner } = useAuth();
  const { data, loading, error, reload } = useQuery(listOptOuts);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-40" />;
  return (
    <div className="space-y-3">
      <p className="text-[15px] text-muted-foreground">
        Chi risponde STOP su WhatsApp o si disiscrive dalle email finisce qui da solo. Puoi escludere un contatto anche dalla sua scheda.
      </p>
      {data.length === 0 ? (
        <EmptyState art="persone" title="Nessun contatto escluso" className="rounded-lg border" />
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-card">
          {data.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{o.contactName}</p>
                <p className="text-sm text-muted-foreground">
                  {o.channel === "tutti" ? "Tutti i messaggi automatici" : o.channel === "whatsapp" ? "Solo WhatsApp" : "Solo email"} · {o.reason ?? "–"} ·{" "}
                  {formatRelative(o.createdAt)}
                </p>
              </div>
              {(isOwner || o.channel === "tutti") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (o.channel !== "tutti" && !window.confirm("Il cliente aveva chiesto di non ricevere messaggi. Vuoi davvero toglierlo dagli esclusi?")) return;
                    try {
                      await removeOptOut(o.id);
                      toast.success("Tolto dagli esclusi");
                    } catch (err) {
                      toast.error("Non salvato", { description: friendlyError(err) });
                    }
                  }}
                >
                  Togli
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

