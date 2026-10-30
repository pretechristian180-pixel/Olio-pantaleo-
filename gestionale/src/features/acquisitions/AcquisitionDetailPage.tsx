import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, House, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ContactActions } from "@/features/contacts/ContactActions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatShortDate, fullName } from "@/lib/format";
import { kindLabel, temperatureLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { addOwner, deleteAcquisition, getAcquisition, updateAcquisition } from "@/services/acquisitions";
import { listTeam } from "@/services/api";
import type { Contact, PropertyKind, Temperature } from "@/types/domain";
import type { AcqSource, Acquisition } from "@/types/acquisitions";
import { acqPhases, daysInPhase, lossLabel, phaseLabel, phaseTone, sourceLabel, STALE_DAYS } from "./labels";
import { AcquisitionMoverProvider, useMoveAcquisition } from "./PhaseDialogs";

export function AcquisitionDetailPage() {
  return (
    <AcquisitionMoverProvider>
      <Detail />
    </AcquisitionMoverProvider>
  );
}

function Detail() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useQuery(() => getAcquisition(id), [id]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-[520px]" />;
  if (!data)
    return (
      <EmptyState
        art="casa"
        title="Acquisizione non trovata"
        action={
          <Button asChild>
            <Link to="/trattative/acquisizioni">Torna alle acquisizioni</Link>
          </Button>
        }
      />
    );
  return <Content a={data} />;
}

function Content({ a }: { a: Acquisition }) {
  const move = useMoveAcquisition();
  const navigate = useNavigate();
  const days = daysInPhase(a.phaseSince);
  const idx = acqPhases.findIndex((p) => p.id === a.phase);
  const next = idx >= 0 ? acqPhases[idx + 1] : undefined;
  const closed = a.phase === "incarico_firmato" || a.phase === "persa";

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to="/trattative/acquisizioni" label="Acquisizioni" />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={phaseTone[a.phase]}>{phaseLabel(a.phase)}</Badge>
        {!closed && (
          <span className={cn("text-[15px]", days > STALE_DAYS ? "font-semibold text-warning" : "text-muted-foreground")}>
            {days === 0 ? "da oggi" : `da ${days} ${days === 1 ? "giorno" : "giorni"}`}
          </span>
        )}
        {a.phase === "persa" && a.lossReason && <span className="text-[15px] text-muted-foreground">{lossLabel[a.lossReason]}</span>}
      </div>
      <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight">{a.address}</h1>
      <p className="text-[17px] text-muted-foreground">{[a.zone, a.city].filter(Boolean).join(", ") || "Città da completare"}</p>

      {/* Azione principale */}
      <div className="mt-6 space-y-3">
        {a.phase === "incarico_firmato" && a.propertyId ? (
          <Button size="lg" className="w-full sm:w-auto" asChild>
            <Link to={`/immobili/${a.propertyId}`}>
              <House aria-hidden />
              Apri l'immobile
            </Link>
          </Button>
        ) : a.phase === "persa" ? (
          a.canEdit && (
            <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => move(a, "primo_contatto")}>
              Riapri l'acquisizione
            </Button>
          )
        ) : (
          a.canEdit && (
            <div className="flex flex-col gap-3 sm:flex-row">
              {next && (
                <Button size="lg" className="w-full sm:w-auto" onClick={() => move(a, next.id)}>
                  {next.id === "incarico_firmato" ? "Incarico firmato!" : `Sposta in ${next.label}`}
                  <ArrowRight aria-hidden />
                </Button>
              )}
              <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => move(a, "persa")}>
                Segna come persa
              </Button>
            </div>
          )
        )}
      </div>

      <div className="mt-8 space-y-5">
        <OwnerCard a={a} />
        {!closed && <NextActionCard a={a} />}
        <DetailsCard a={a} />
        {a.canEdit && a.phase !== "incarico_firmato" && (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={async () => {
              if (!window.confirm("Eliminare questa acquisizione? Il proprietario resta tra i contatti.")) return;
              try {
                await deleteAcquisition(a.id);
                toast.success("Acquisizione eliminata");
                navigate("/trattative/acquisizioni", { replace: true });
              } catch (err) {
                toast.error("Non eliminata", { description: friendlyError(err) });
              }
            }}
          >
            <Trash2 aria-hidden />
            Elimina acquisizione
          </Button>
        )}
      </div>
    </div>
  );
}

function OwnerCard({ a }: { a: Acquisition }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2) return toast.error("Scrivi il nome del proprietario");
    setBusy(true);
    try {
      await addOwner(a.id, f.name, f.phone);
      toast.success("Proprietario aggiunto");
      setAdding(false);
    } catch (err) {
      toast.error("Non salvato", { description: friendlyError(err) });
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proprietario</CardTitle>
      </CardHeader>
      <CardContent>
        {a.owner ? (
          <>
            <Link to={`/contatti/${a.owner.id}`} className="text-[17px] font-semibold hover:text-primary-strong">
              {fullName(a.owner)}
            </Link>
            {a.owner.phone && <p className="text-muted-foreground">{a.owner.phone}</p>}
            {a.owner.phone && (
              <ContactActions className="mt-4" compact contact={{ id: a.owner.id, firstName: a.owner.firstName, lastName: a.owner.lastName, phone: a.owner.phone } as Contact} />
            )}
          </>
        ) : adding ? (
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome e cognome" htmlFor="ow-name">
                <Input id="ow-name" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} autoFocus />
              </Field>
              <Field label="Telefono" htmlFor="ow-phone">
                <Input id="ow-phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} />
              </Field>
            </div>
            <Button type="submit" disabled={busy}>
              <Check aria-hidden />
              Salva proprietario
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-muted-foreground">Non ancora inserito.</p>
            {a.canEdit && (
              <Button variant="outline" onClick={() => setAdding(true)}>
                <UserPlus aria-hidden />
                Aggiungi proprietario
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NextActionCard({ a }: { a: Acquisition }) {
  const [text, setText] = useState(a.nextAction);
  const [date, setDate] = useState(a.nextActionDate ?? "");
  const [busy, setBusy] = useState(false);
  const changed = text !== a.nextAction || date !== (a.nextActionDate ?? "");
  const quick = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("sv-SE");

  async function save() {
    setBusy(true);
    try {
      await updateAcquisition(a.id, { nextAction: text, nextActionDate: date || null });
      toast.success("Prossima azione salvata", { description: date ? formatShortDate(date) : undefined });
    } catch (err) {
      toast.error("Non salvata", { description: friendlyError(err) });
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prossima azione</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Cosa fare" htmlFor="na-text">
          <Input id="na-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Es. Richiamare per fissare la valutazione" disabled={!a.canEdit} />
        </Field>
        <Field label="Quando" htmlFor="na-date">
          <Input id="na-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!a.canEdit} />
        </Field>
        {a.canEdit && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Oggi", d: 0 },
              { label: "Domani", d: 1 },
              { label: "Tra 3 giorni", d: 3 },
              { label: "Tra una settimana", d: 7 },
            ].map((q) => (
              <Button key={q.label} type="button" variant={date === quick(q.d) ? "secondary" : "outline"} size="sm" onClick={() => setDate(quick(q.d))}>
                {q.label}
              </Button>
            ))}
          </div>
        )}
        {a.canEdit && changed && (
          <Button onClick={save} disabled={busy}>
            <Check aria-hidden />
            Salva
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function DetailsCard({ a }: { a: Acquisition }) {
  const { isOwner } = useAuth();
  const team = useQuery(() => (isOwner ? listTeam() : Promise.resolve(null)), [isOwner]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const num = (v: number | null) => (v == null ? "" : String(v));
  const [f, setF] = useState({
    city: a.city,
    kind: a.kind ?? "",
    sqm: num(a.sqm),
    asking: num(a.askingPrice),
    valued: num(a.valuedPrice),
    temperature: a.temperature,
    zone: a.zone,
    source: a.source ?? "",
    notes: a.notes,
    agentId: a.agentId ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const toNum = (s: string) => (s.replace(/[^\d]/g, "") ? Number(s.replace(/[^\d]/g, "")) : null);
  const ro = !a.canEdit || a.phase === "incarico_firmato";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateAcquisition(a.id, {
        city: f.city,
        kind: (f.kind || null) as PropertyKind | null,
        sqm: toNum(f.sqm),
        askingPrice: toNum(f.asking),
        valuedPrice: toNum(f.valued),
        temperature: f.temperature as Temperature,
        zone: f.zone,
        source: (f.source || null) as AcqSource | null,
        notes: f.notes,
        ...(isOwner && f.agentId ? { agentId: f.agentId } : {}),
      });
      toast.success("Dati salvati");
    } catch (err) {
      toast.error("Non salvati", { description: friendlyError(err) });
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Immobile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={ro} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Città" htmlFor="ad-city">
                <Input id="ad-city" value={f.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="Tipo" htmlFor="ad-kind">
                <Select id="ad-kind" value={f.kind} onChange={(e) => set("kind", e.target.value)}>
                  <option value="">Da definire</option>
                  {(Object.keys(kindLabel) as PropertyKind[]).map((k) => (
                    <option key={k} value={k}>
                      {kindLabel[k]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Metri quadri (stima)" htmlFor="ad-sqm">
                <Input id="ad-sqm" inputMode="numeric" value={f.sqm} onChange={(e) => set("sqm", e.target.value)} />
              </Field>
              <Field label="Quanto è caldo" htmlFor="ad-temp">
                <Select id="ad-temp" value={f.temperature} onChange={(e) => set("temperature", e.target.value)}>
                  {(Object.keys(temperatureLabel) as Temperature[]).map((t) => (
                    <option key={t} value={t}>
                      {temperatureLabel[t].label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prezzo chiesto (€)" htmlFor="ad-ask">
                <Input id="ad-ask" inputMode="numeric" value={f.asking} onChange={(e) => set("asking", e.target.value)} />
              </Field>
              <Field label="Nostra valutazione (€)" htmlFor="ad-val">
                <Input id="ad-val" inputMode="numeric" value={f.valued} onChange={(e) => set("valued", e.target.value)} />
              </Field>
            </div>

            <button type="button" onClick={() => setMore((m) => !m)} className="flex h-11 items-center gap-1.5 font-semibold text-primary-strong" aria-expanded={more}>
              <ChevronDown className={cn("size-5 transition-transform", more && "rotate-180")} aria-hidden />
              Altri dettagli
            </button>
            {more && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Zona" htmlFor="ad-zone">
                    <Input id="ad-zone" value={f.zone} onChange={(e) => set("zone", e.target.value)} />
                  </Field>
                  <Field label="Come l'abbiamo saputo" htmlFor="ad-src">
                    <Select id="ad-src" value={f.source} onChange={(e) => set("source", e.target.value)}>
                      <option value="">Non indicato</option>
                      {(Object.keys(sourceLabel) as AcqSource[]).map((s) => (
                        <option key={s} value={s}>
                          {sourceLabel[s]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {isOwner && team.data && (
                  <Field label="Agente che la segue" htmlFor="ad-agent">
                    <Select id="ad-agent" value={f.agentId} onChange={(e) => set("agentId", e.target.value)}>
                      {team.data.members
                        .filter((m) => m.active)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {fullName(m)}
                          </option>
                        ))}
                    </Select>
                  </Field>
                )}
                <Field label="Note" htmlFor="ad-notes">
                  <Textarea id="ad-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
                </Field>
              </div>
            )}
          </fieldset>
          {!ro && (
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>
              <Check aria-hidden />
              {busy ? "Salvataggio…" : "Salva i dati"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
