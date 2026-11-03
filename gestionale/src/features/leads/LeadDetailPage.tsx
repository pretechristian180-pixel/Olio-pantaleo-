import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarPlus, Check, Home, Mail, MessageCircle, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAppointmentDialog } from "@/features/agenda/AppointmentDialog";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { phoneDigits, whatsappLink } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listTeam } from "@/services/api";
import { assignLead, getLead, markContacted, setLeadState } from "@/services/leads";
import type { Lead } from "@/types/leads";
import { isLate, lostReasons, scoreLevel, since, sourceLabel, stateLabel } from "./labels";

/** Scheda del lead: chi è, cosa chiede, perché ha quel punteggio e i pulsanti per richiamarlo */
export function LeadDetailPage() {
  const { id = "" } = useParams();
  const { data: l, loading, error, reload } = useQuery(() => getLead(id), [id]);
  const { isOwner } = useAuth();
  const { openAppointment } = useAppointmentDialog();
  const [losing, setLosing] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !l) return <Skeleton className="h-80 w-full" />;

  const level = scoreLevel(l.score);
  const open = l.state === "nuovo" || l.state === "contattato";
  const contact = (channel: "chiamata" | "whatsapp" | "email") => () => {
    markContacted(l.id, channel).catch((e) => toast.error("Non registrato", { description: friendlyError(e) }));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink to="/contatti/lead" label="Lead" />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">
            {l.firstName} {l.lastName}
          </h1>
          <Badge tone={stateLabel[l.state].tone}>{stateLabel[l.state].label}</Badge>
        </div>
        <p className="mt-1 text-[17px] text-muted-foreground">
          Da {sourceLabel(l)} · {since(l.createdAt)}
          {l.agentName ? ` · segue ${l.agentName}` : ""}
        </p>
        {isLate(l) && <p className="mt-2 font-semibold text-red-700">Nessuno l'ha ancora richiamato: chi risponde per primo di solito prende il cliente.</p>}
      </div>

      {/* Azioni principali: sempre con testo, grandi */}
      <div className="grid grid-cols-2 gap-2">
        {l.phone && (
          <Button size="lg" className="h-14" asChild>
            <a href={`tel:${phoneDigits(l.phone)}`} onClick={contact("chiamata")}>
              <Phone aria-hidden />
              Chiama
            </a>
          </Button>
        )}
        {l.phone && (
          <Button variant="outline" size="lg" className="h-14" asChild>
            <a href={whatsappLink(l.phone)} target="_blank" rel="noreferrer" onClick={contact("whatsapp")}>
              <MessageCircle aria-hidden className="text-success" />
              WhatsApp
            </a>
          </Button>
        )}
        {l.email && (
          <Button variant="outline" size="lg" className="h-14" asChild>
            <a href={`mailto:${l.email}`} onClick={contact("email")}>
              <Mail aria-hidden />
              Email
            </a>
          </Button>
        )}
        <Button variant="outline" size="lg" className="h-14" onClick={() => openAppointment({ contactId: l.contactId ?? undefined, propertyId: l.propertyId ?? undefined, kind: "visita" })} disabled={!l.contactId}>
          <CalendarPlus aria-hidden />
          Appuntamento
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center gap-3">
            <span className={cn("flex size-14 shrink-0 flex-col items-center justify-center rounded-full border-2 font-bold tabular-nums", level.tone === "red" ? "border-red-300 text-red-700" : level.tone === "amber" ? "border-amber-300 text-amber-700" : "border-sky-300 text-sky-700")}>
              {l.score}
            </span>
            <div>
              <p className="text-[17px] font-semibold">Lead {level.label.toLowerCase()}</p>
              <p className="text-[15px] text-muted-foreground">Punteggio da 0 a 100, calcolato da quello che ha scritto</p>
            </div>
          </div>
          <ul className="space-y-1">
            {l.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2 text-[15px]">
                <Check className={cn("mt-0.5 size-4 shrink-0", r.includes("spam") ? "text-red-600" : "text-success")} aria-hidden />
                {r}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h2 className="text-[17px] font-semibold">Cosa ha scritto</h2>
          <p className="whitespace-pre-line text-[17px]">{l.message || "Nessun messaggio: ha lasciato solo i contatti."}</p>
          <dl className="space-y-1 text-[15px]">
            {l.phone && <Row label="Telefono" value={l.phone} />}
            {l.email && <Row label="Email" value={l.email} />}
            {l.reference && <Row label="Annuncio" value={l.reference} />}
            {l.firstContactAt && <Row label="Primo contatto" value={`${since(l.firstContactAt)} (${responseTime(l)})`} />}
            {l.lostReason && <Row label="Motivo" value={l.lostReason} />}
          </dl>
          {l.propertyId && l.propertyLabel && (
            <Link to={`/immobili/${l.propertyId}`} className="flex min-h-12 items-center gap-2 rounded-lg bg-muted px-4 font-medium">
              <Home className="size-5" aria-hidden />
              {l.propertyLabel}
            </Link>
          )}
          {l.contactId && (
            <Link to={`/contatti/${l.contactId}`} className="flex min-h-12 items-center gap-2 rounded-lg bg-muted px-4 font-medium">
              <UserRound className="size-5" aria-hidden />
              Apri la scheda del contatto
            </Link>
          )}
        </CardContent>
      </Card>

      {isOwner && <AssignCard lead={l} />}

      {open ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg" onClick={() => setLosing(true)}>
            Segna come perso
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="text-muted-foreground"
            onClick={() =>
              setLeadState(l.id, "spam")
                .then(() => toast.success("Segnato come spam"))
                .catch((e) => toast.error("Non salvato", { description: friendlyError(e) }))
            }
          >
            È spam
          </Button>
        </div>
      ) : (
        (l.state === "perso" || l.state === "spam") && (
          <Button variant="outline" size="lg" className="w-full" onClick={() => setLeadState(l.id, "nuovo").then(() => toast.success("Lead riaperto"))}>
            Riapri il lead
          </Button>
        )
      )}

      <Dialog open={losing} onOpenChange={setLosing}>
        <DialogContent title="Perché è perso?" description="Ci serve per capire quali canali funzionano.">
          {losing && <LostForm lead={l} onDone={() => setLosing(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}

function responseTime(l: Lead) {
  const min = Math.round((new Date(l.firstContactAt!).getTime() - new Date(l.createdAt).getTime()) / 60_000);
  return min < 60 ? `risposto in ${Math.max(1, min)} min` : `risposto dopo ${Math.round(min / 60)} ore`;
}

function AssignCard({ lead: l }: { lead: Lead }) {
  const { data } = useQuery(listTeam);
  const members = (data?.members ?? []).filter((m) => m.active);
  if (members.length < 2) return null;
  return (
    <Field label="Lo segue" htmlFor="lead-agent">
      <Select
        id="lead-agent"
        value={l.agentId ?? ""}
        onChange={(e) =>
          assignLead(l.id, e.target.value)
            .then(() => toast.success("Lead riassegnato", { description: "Trova il promemoria tra le sue cose da fare." }))
            .catch((err) => toast.error("Non riassegnato", { description: friendlyError(err) }))
        }
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.firstName} {m.lastName}
            {m.role === "titolare" ? " (titolare)" : ""}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function LostForm({ lead, onDone }: { lead: Lead; onDone: () => void }) {
  const [reason, setReason] = useState(lostReasons[0]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    const r = reason === "Altro" ? other.trim() : reason;
    if (!r) return toast.error("Scrivi il motivo");
    setBusy(true);
    try {
      await setLeadState(lead.id, "perso", r);
      toast.success("Lead chiuso");
      onDone();
    } catch (e) {
      toast.error("Non salvato", { description: friendlyError(e) });
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="space-y-2" role="radiogroup" aria-label="Motivo">
        {[...lostReasons, "Altro"].map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className={cn("flex min-h-12 w-full items-center rounded-lg border px-4 text-left text-[17px]", reason === r ? "border-primary bg-primary-soft font-semibold text-primary-strong" : "bg-card")}
          >
            {r}
          </button>
        ))}
      </div>
      {reason === "Altro" && (
        <Field label="Motivo" htmlFor="lost-other">
          <Input id="lost-other" value={other} onChange={(e) => setOther(e.target.value)} />
        </Field>
      )}
      <Button size="lg" className="w-full" onClick={save} disabled={busy}>
        {busy ? "Salvo…" : "Chiudi il lead"}
      </Button>
    </div>
  );
}
