import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, Check, Loader2, MessageCircle, Pencil, PencilLine, RotateCw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatRelative, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listTeam } from "@/services/api";
import {
  approvalLink,
  decide,
  deleteDraft,
  getBrand,
  getVideo,
  listAvatars,
  listSocialAccounts,
  proposedSlot,
  schedule,
  startGeneration,
  tick,
} from "@/services/studio";
import type { BrandSettings, Platform, SocialAccount, VideoDetail } from "@/types/studio";
import { finalCaption, formatSlot, platformAiLabel, platformLabel, postStatus, toLocalInput, videoStatus } from "./labels";
import { ReelPlayer } from "./ReelPlayer";

export function VideoPage() {
  const { id = "" } = useParams();
  const { agency } = useAuth();
  const { data, loading, error, reload } = useQuery(
    async () => {
      const [detail, brand, accounts, avatars] = await Promise.all([getVideo(id), getBrand(), listSocialAccounts(), listAvatars()]);
      return { detail, brand, accounts, avatars };
    },
    [id],
  );

  // Mentre il video si prepara controlliamo ogni pochi secondi (la Fase 2 userà i webhook)
  const generating = data?.detail?.video.status === "in_generazione";
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => {
      tick()
        .catch(() => undefined)
        .finally(reload);
    }, 4000);
    return () => clearInterval(t);
  }, [generating, reload]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-[560px]" />;
  if (!data.detail)
    return (
      <EmptyState
        art="ricerca"
        title="Video non trovato"
        action={
          <Button asChild>
            <Link to="/studio">Torna a Studio</Link>
          </Button>
        }
      />
    );

  const { detail, brand, accounts, avatars } = data;
  const v = detail.video;
  const avatar = avatars.find((a) => a.status === "pronto") ?? avatars[0];
  const s = videoStatus[v.status];
  const hasVideo = !!v.videoUrl && !["in_generazione", "errore", "bozza", "script_pronto"].includes(v.status);

  return (
    <div>
      <BackLink to={v.status === "da_approvare" ? "/studio" : "/studio?vista=video"} label="Studio" />
      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <div>
          {hasVideo ? (
            <ReelPlayer
              photos={detail.photoUrls.length ? detail.photoUrls.map((url, i) => ({ id: `f${i}`, url, scene: "soggiorno" as const })) : v.photoIds.map((pid) => ({ id: pid, scene: "soggiorno" as const }))}
              intro={v.intro}
              outro={v.outro}
              duration={v.duration}
              avatarName={avatar?.personName || "titolare"}
              agencyName={agency?.name ?? ""}
              agencyPhone={agency?.phone}
              address={v.property.address}
            />
          ) : (
            <StatusPanel detail={detail} onRetry={reload} />
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <div>
            <Badge tone={s.tone}>{s.label}</Badge>
            <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight">{v.property.address}</h1>
            <p className="text-[17px] text-muted-foreground">
              {v.property.title} ·{" "}
              <Link to={`/immobili/${v.propertyId}`} className="font-medium text-primary-strong underline-offset-4 hover:underline">
                apri la scheda
              </Link>
            </p>
          </div>

          <Actions detail={detail} brand={brand} accounts={accounts} />

          <Card>
            <CardHeader>
              <CardTitle>Testo del post</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-[17px] leading-relaxed">{finalCaption(v.caption, [...v.hashtags, ...brand.fixedHashtags], brand.aiDisclaimer)}</p>
            </CardContent>
          </Card>

          {detail.posts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pubblicazione</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {detail.posts.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0">
                      <span className="font-semibold">{platformLabel[p.platform]}</span>
                      <span className="text-muted-foreground">{formatSlot(p.publishAt)}</span>
                      <Badge tone={postStatus[p.status].tone} className="ml-auto">
                        {postStatus[p.status].label}
                      </Badge>
                      {!accounts.some((a) => a.platform === p.platform && a.status === "collegato") && p.status === "in_coda" && (
                        <p className="w-full text-sm text-warning">Account {platformLabel[p.platform]} non ancora collegato.</p>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {detail.approvals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Decisioni</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {detail.approvals.map((a) => (
                    <li key={a.id} className="text-[15px]">
                      <span className="font-semibold">
                        {a.outcome === "approvato" ? "Approvato" : a.outcome === "modifiche" ? "Modifiche richieste" : "Scartato"}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {a.approverName ? `da ${a.approverName} ` : ""}
                        {a.via === "whatsapp" ? "dal link WhatsApp " : ""}
                        {formatRelative(a.createdAt)}
                      </span>
                      {a.note && <p className="mt-0.5 text-foreground/85">“{a.note}”</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** Al posto del player: video in preparazione, errore o non ancora generato */
function StatusPanel({ detail, onRetry }: { detail: VideoDetail; onRetry: () => void }) {
  const v = detail.video;
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      await startGeneration(v.id);
      toast.success("Ci riproviamo", { description: "Ti avvisiamo quando il video è pronto." });
      onRetry();
    } catch (err) {
      toast.error("Video non avviato", { description: friendlyError(err) });
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto flex aspect-[9/16] w-full max-w-[340px] flex-col items-center justify-center rounded-2xl border bg-card px-6 text-center shadow-card">
      {v.status === "in_generazione" ? (
        <>
          <Loader2 className="size-12 animate-spin text-primary" aria-hidden />
          <p className="mt-5 text-xl font-semibold">Stiamo preparando il video</p>
          <p className="mt-2 text-muted-foreground">Puoi chiudere questa pagina: ti avvisiamo quando è pronto da approvare.</p>
        </>
      ) : v.status === "errore" ? (
        <>
          <XCircle className="size-12 text-destructive" aria-hidden />
          <p className="mt-5 text-xl font-semibold">Il video non è riuscito</p>
          <p className="mt-2 text-foreground/80">{v.errorMessage ?? "C'è stato un problema durante la preparazione."}</p>
          {detail.canEdit && (
            <Button size="lg" className="mt-6 w-full" onClick={retry} disabled={busy}>
              <RotateCw aria-hidden />
              {busy ? "Avvio…" : "Riprova"}
            </Button>
          )}
        </>
      ) : v.status === "scartato" ? (
        <>
          <Trash2 className="size-12 text-muted-foreground" aria-hidden />
          <p className="mt-5 text-xl font-semibold">Video scartato</p>
        </>
      ) : (
        <>
          <PencilLine className="size-12 text-muted-foreground" aria-hidden />
          <p className="mt-5 text-xl font-semibold">Video non ancora generato</p>
          {detail.canEdit && (
            <Button size="lg" className="mt-6 w-full" onClick={retry} disabled={busy}>
              {busy ? "Avvio…" : "Genera video"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function Actions({ detail, brand, accounts }: { detail: VideoDetail; brand: BrandSettings; accounts: SocialAccount[] }) {
  const v = detail.video;
  const [dialog, setDialog] = useState<null | "approva" | "programma" | "data" | "modifiche" | "scarta">(null);
  const lastNote = detail.approvals.find((a) => a.outcome === "modifiche")?.note;

  return (
    <>
      {v.status === "da_approvare" && detail.canApprove && (
        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={() => setDialog("approva")}>
            <Check aria-hidden />
            Approva e programma
          </Button>
          <div className="grid gap-3 min-[420px]:grid-cols-2">
            <Button variant="outline" size="lg" onClick={() => setDialog("modifiche")}>
              <Pencil aria-hidden />
              Chiedi modifiche
            </Button>
            <Button variant="outline" size="lg" className="text-destructive" onClick={() => setDialog("scarta")}>
              <Trash2 aria-hidden />
              Scarta
            </Button>
          </div>
        </div>
      )}

      {v.status === "da_approvare" && !detail.canApprove && (
        <p className="rounded-lg bg-muted px-4 py-3 text-[17px]">
          Il video aspetta l'approvazione del titolare. Puoi mandargli il link qui sotto.
        </p>
      )}

      {v.status === "da_approvare" && (detail.canEdit || detail.canApprove) && <WhatsAppLink detail={detail} brand={brand} />}

      {v.status === "modifiche_richieste" && (
        <div className="space-y-3">
          {lastNote && (
            <p className="rounded-lg bg-warning-soft px-4 py-3 text-[17px] text-warning">
              <strong>Da cambiare:</strong> {lastNote}
            </p>
          )}
          {detail.canEdit && (
            <Button size="lg" className="w-full" asChild>
              <Link to={`/studio/video/${v.id}/modifica`}>
                <Pencil aria-hidden />
                Modifica e rigenera
              </Link>
            </Button>
          )}
        </div>
      )}

      {(v.status === "bozza" || v.status === "script_pronto" || v.status === "errore") && detail.canEdit && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" size="lg" asChild>
            <Link to={`/studio/video/${v.id}/modifica`}>
              <Pencil aria-hidden />
              Modifica testo e foto
            </Link>
          </Button>
          {v.status === "bozza" && <DeleteDraft id={v.id} />}
        </div>
      )}

      {v.status === "approvato" && detail.canApprove && (
        <Button size="lg" className="w-full" onClick={() => setDialog("programma")}>
          <CalendarClock aria-hidden />
          Programma la pubblicazione
        </Button>
      )}

      {v.status === "programmato" && detail.canApprove && detail.posts.some((p) => p.status === "in_coda") && (
        <Button variant="outline" size="lg" className="w-full" onClick={() => setDialog("data")}>
          <CalendarClock aria-hidden />
          Cambia data di pubblicazione
        </Button>
      )}

      <Dialog open={dialog === "approva" || dialog === "programma" || dialog === "data"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent
          title={dialog === "data" ? "Nuova data di pubblicazione" : "Quando lo pubblichiamo?"}
          description={dialog === "data" ? undefined : "Ti proponiamo il primo orario libero tra quelli preferiti: puoi cambiarlo."}
        >
          {dialog && (
            <ScheduleForm
              mode={dialog === "approva" ? "approva" : dialog === "data" ? "data" : "programma"}
              detail={detail}
              brand={brand}
              accounts={accounts}
              onDone={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "modifiche"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title="Cosa vuoi cambiare?" description="Chi ha creato il video riceve la tua nota tra le cose da fare.">
          {dialog === "modifiche" && <ChangesForm id={v.id} onDone={() => setDialog(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "scarta"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title="Scartare il video?" description="Non verrà pubblicato. Il video resta conteggiato tra quelli del mese.">
          {dialog === "scarta" && <DiscardForm id={v.id} onDone={() => setDialog(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function WhatsAppLink({ detail, brand }: { detail: VideoDetail; brand: BrandSettings }) {
  const [busy, setBusy] = useState(false);
  const team = useQuery(listTeam);

  async function send() {
    setBusy(true);
    try {
      const link = await approvalLink(detail.video.id);
      const members = team.data?.members ?? [];
      const approver = members.find((m) => m.id === brand.approverId) ?? members.find((m) => m.role === "titolare");
      const phone = (approver?.phone ?? "").replace(/\D/g, "");
      const text = `Il video di ${detail.video.property.address} è pronto da approvare: ${link}`;
      const url = phone
        ? `https://wa.me/${phone.startsWith("39") ? phone : `39${phone}`}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener");
      toast.success("Link creato", { description: `Vale 7 giorni e si può usare una volta sola${approver ? ` · per ${fullName(approver)}` : ""}.` });
    } catch (err) {
      toast.error("Link non creato", { description: friendlyError(err) });
    }
    setBusy(false);
  }

  return (
    <Button variant="outline" size="lg" className="w-full" onClick={send} disabled={busy}>
      <MessageCircle aria-hidden />
      {busy ? "Creo il link…" : "Invia il link di approvazione su WhatsApp"}
    </Button>
  );
}

function ScheduleForm({
  mode,
  detail,
  brand,
  accounts,
  onDone,
}: {
  mode: "approva" | "programma" | "data";
  detail: VideoDetail;
  brand: BrandSettings;
  accounts: SocialAccount[];
  onDone: () => void;
}) {
  const v = detail.video;
  const current = detail.posts.find((p) => p.status === "in_coda")?.publishAt;
  const slot = useQuery(proposedSlot);
  const [when, setWhen] = useState<string>("");
  const [platforms, setPlatforms] = useState<Platform[]>(brand.defaultPlatforms.length ? brand.defaultPlatforms : ["instagram"]);
  const [preview, setPreview] = useState<Platform>(platforms[0] ?? "instagram");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!when && (current || slot.data)) setWhen(toLocalInput(mode === "data" && current ? current : slot.data!));
  }, [slot.data, current, mode, when]);

  const caption = finalCaption(v.caption, [...v.hashtags, ...brand.fixedHashtags], brand.aiDisclaimer);
  const toggle = (p: Platform) => setPlatforms((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!when) return toast.error("Scegli data e ora");
    const iso = new Date(when).toISOString();
    if (new Date(iso).getTime() < Date.now()) return toast.error("Scegli una data futura");
    if (mode !== "data" && platforms.length === 0) return toast.error("Scegli almeno un social");
    setBusy(true);
    try {
      if (mode === "approva") await decide(v.id, "approvato", "", iso, platforms);
      else await schedule(v.id, iso, platforms);
      toast.success(mode === "approva" ? "Video approvato e programmato" : "Data aggiornata", { description: formatSlot(iso) });
      onDone();
    } catch (err) {
      toast.error("Non salvato", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Data e ora" htmlFor="sch-when" hint={slot.data && mode !== "data" ? `Primo orario libero: ${formatSlot(slot.data)}` : undefined}>
        <Input id="sch-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </Field>

      {mode !== "data" && (
        <fieldset>
          <legend className="mb-2 text-[15px] font-medium">Dove lo pubblichiamo</legend>
          <div className="space-y-2">
            {(["instagram", "facebook", "tiktok"] as Platform[]).map((p) => {
              const acc = accounts.find((a) => a.platform === p && a.status === "collegato");
              return (
                <label key={p} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2", platforms.includes(p) && "border-primary bg-primary-soft/50")}>
                  <input type="checkbox" checked={platforms.includes(p)} onChange={() => toggle(p)} className="size-5 accent-primary" />
                  <span className="flex-1">
                    <span className="block font-semibold">{platformLabel[p]}</span>
                    <span className="block text-sm text-muted-foreground">{acc ? acc.name : "Account non ancora collegato (si collega in Fase 3)"}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {mode !== "data" && platforms.length > 0 && (
        <div>
          <p className="mb-2 text-[15px] font-medium">Anteprima del testo</p>
          <div className="mb-2 flex flex-wrap gap-2">
            {platforms.map((p) => (
              <Button key={p} type="button" size="sm" variant={preview === p ? "secondary" : "ghost"} onClick={() => setPreview(p)}>
                {platformLabel[p]}
              </Button>
            ))}
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{caption}</p>
            <p className="mt-3 border-t pt-2 text-sm text-muted-foreground">
              {platformAiLabel[platforms.includes(preview) ? preview : platforms[0]]} · {caption.length} caratteri
              {caption.length > 2200 && <span className="text-destructive"> (troppo lungo: massimo 2200)</span>}
            </p>
          </div>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={busy || !when}>
        <Check aria-hidden />
        {busy ? "Salvataggio…" : mode === "approva" ? "Approva e programma" : mode === "data" ? "Cambia data" : "Programma"}
      </Button>
    </form>
  );
}

function ChangesForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return toast.error("Scrivi cosa cambiare");
    setBusy(true);
    try {
      await decide(id, "modifiche", note, null, []);
      toast.success("Richiesta inviata");
      onDone();
    } catch (err) {
      toast.error("Non inviata", { description: friendlyError(err) });
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="La tua nota" htmlFor="mod-note">
        <Textarea id="mod-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. togli la foto del bagno e cita il terrazzo all'inizio" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Invio…" : "Chiedi modifiche"}
      </Button>
    </form>
  );
}

function DiscardForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await decide(id, "scartato", "", null, []);
      toast.success("Video scartato");
      onDone();
    } catch (err) {
      toast.error("Non scartato", { description: friendlyError(err) });
      setBusy(false);
    }
  }
  return (
    <Button variant="destructive" size="lg" className="w-full" onClick={confirm} disabled={busy}>
      <Trash2 aria-hidden />
      {busy ? "Un momento…" : "Sì, scarta il video"}
    </Button>
  );
}

function DeleteDraft({ id }: { id: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="lg"
      className="text-destructive"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await deleteDraft(id);
          toast.success("Bozza eliminata");
          navigate("/studio?vista=video", { replace: true });
        } catch (err) {
          toast.error("Non eliminata", { description: friendlyError(err) });
          setBusy(false);
        }
      }}
    >
      <Trash2 aria-hidden />
      Elimina bozza
    </Button>
  );
}
