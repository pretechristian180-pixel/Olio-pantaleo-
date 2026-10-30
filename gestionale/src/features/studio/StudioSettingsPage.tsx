import { useEffect, useRef, useState } from "react";
import { Check, Download, FileSignature, Lightbulb, Link2, Plus, Upload, UserRoundCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatShortDate, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listTeam } from "@/services/api";
import {
  activeConsent,
  consentPdfUrl,
  getBrand,
  getUsage,
  listAvatars,
  listSocialAccounts,
  revokeConsent,
  setupAvatar,
  signConsent,
  tick,
  updateBrand,
  uploadTrainingVideo,
} from "@/services/studio";
import type { Agent } from "@/types/domain";
import type { AvatarProfile, BrandSettings, BrandTone, Platform } from "@/types/studio";
import { buildConsentPdf } from "./consentPdf";
import { avatarStatus, platformLabel, toneLabel, weekDays } from "./labels";
import { UsageBar } from "./StudioPage";

/** Impostazioni di Studio: avatar e consenso, brand, account social, utilizzo. */
export function StudioSettingsPage() {
  const { isOwner } = useAuth();
  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to="/studio" label="Studio" />
      <PageHeader title="Impostazioni Studio" subtitle={isOwner ? "Avatar, stile dei video, social e utilizzo" : "Il tuo avatar"} />
      <div className="space-y-6">
        <AvatarSection />
        {isOwner && (
          <>
            <BrandSection />
            <SocialSection />
            <UsageSection />
          </>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
 * Avatar e consenso
 * ===================================================================== */

function AvatarSection() {
  const { agent, isOwner } = useAuth();
  const { data, loading, error, reload } = useQuery(async () => {
    const [avatars, team] = await Promise.all([listAvatars(), isOwner ? listTeam() : Promise.resolve({ members: [] as Agent[] })]);
    return { avatars, members: team.members.filter((m) => m.active) };
  });
  const mine = data?.avatars.find((a) => a.profileId === agent?.id);

  // Mentre l'avatar si prepara aggiorniamo da soli
  const preparing = data?.avatars.some((a) => a.status === "in_addestramento");
  useEffect(() => {
    if (!preparing) return;
    const t = setInterval(() => tick().catch(() => undefined).finally(reload), 5000);
    return () => clearInterval(t);
  }, [preparing, reload]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avatar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-muted-foreground">
          L'avatar è la versione digitale di chi parla nei video. È l'unica parte generata dall'AI: la casa si vede sempre con le sue foto reali.
        </p>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading || !data ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            {mine ? (
              <MyAvatar avatar={mine} />
            ) : !isOwner ? (
              <p className="rounded-lg bg-muted px-4 py-3">Il titolare non ti ha ancora abilitato come avatar.</p>
            ) : null}

            {isOwner && (
              <div>
                <h3 className="mb-2 text-[17px] font-semibold">Persone dell'agenzia</h3>
                <ul className="divide-y rounded-lg border">
                  {data.members.map((m) => {
                    const av = data.avatars.find((a) => a.profileId === m.id);
                    return <MemberRow key={m.id} member={m} avatar={av} isMe={m.id === agent?.id} />;
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MemberRow({ member, avatar, isMe }: { member: Agent; avatar?: AvatarProfile; isMe: boolean }) {
  const [busy, setBusy] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const st = avatar ? avatarStatus[avatar.status] : null;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {fullName(member)}
          {isMe && <span className="font-normal text-muted-foreground"> (tu)</span>}
        </p>
        <p className="text-sm text-muted-foreground">{member.role === "titolare" ? "Titolare" : "Agente"}</p>
      </div>
      {st ? (
        <Badge tone={st.tone}>{st.label}</Badge>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await setupAvatar(member.id);
              toast.success(`${member.firstName} è abilitato come avatar`, {
                description: isMe ? "Ora registra il video e firma il consenso qui sopra." : "Dovrà registrare il video e firmare il consenso dal suo account.",
              });
            } catch (err) {
              toast.error("Non abilitato", { description: friendlyError(err) });
            }
            setBusy(false);
          }}
        >
          <UserRoundCheck aria-hidden />
          Abilita come avatar
        </Button>
      )}
      {avatar?.status === "revocato" && (
        <Button variant="outline" size="sm" onClick={() => setupAvatar(member.id).catch((e) => toast.error(friendlyError(e)))}>
          Ricomincia
        </Button>
      )}
      {avatar && !isMe && (avatar.status === "pronto" || avatar.status === "in_addestramento") && (
        <>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRevokeOpen(true)}>
            Revoca consenso
          </Button>
          <RevokeDialog avatar={avatar} open={revokeOpen} onOpenChange={setRevokeOpen} />
        </>
      )}
    </li>
  );
}

function MyAvatar({ avatar }: { avatar: AvatarProfile }) {
  const [revokeOpen, setRevokeOpen] = useState(false);
  const st = avatarStatus[avatar.status];

  if (avatar.status === "revocato")
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-4">
        <p className="font-semibold text-destructive">Consenso revocato</p>
        <p className="mt-1">Il tuo avatar è bloccato e nessun nuovo video può usarlo. La cancellazione presso il fornitore è in corso.</p>
      </div>
    );

  if (avatar.status === "in_addestramento" || avatar.status === "pronto")
    return (
      <div className="rounded-lg border px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[17px] font-semibold">Il tuo avatar</p>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">
          {avatar.status === "pronto"
            ? "È pronto: puoi creare video da Studio."
            : "Lo stiamo preparando dal tuo video: di solito servono pochi minuti."}
        </p>
        <p className="mt-2 text-[15px]">
          Consenso firmato da <strong>{avatar.signer}</strong> il {avatar.consentSignedAt ? formatShortDate(avatar.consentSignedAt) : "–"} (testo
          versione {avatar.consentVersion}).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {avatar.consentPdfPath && (
            <Button
              variant="outline"
              onClick={async () => {
                const url = await consentPdfUrl(avatar.consentPdfPath!);
                if (url) window.open(url, "_blank", "noopener");
                else toast.error("PDF non disponibile");
              }}
            >
              <Download aria-hidden />
              Consenso firmato (PDF)
            </Button>
          )}
          <Button variant="ghost" className="text-destructive" onClick={() => setRevokeOpen(true)}>
            Revoca consenso
          </Button>
        </div>
        <RevokeDialog avatar={avatar} open={revokeOpen} onOpenChange={setRevokeOpen} />
      </div>
    );

  return <AvatarWizard avatar={avatar} />;
}

function AvatarWizard({ avatar }: { avatar: AvatarProfile }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const step = avatar.trainingVideoPath ? 2 : 1;

  async function onFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("video/")) return toast.error("Scegli un video");
    if (file.size > 50 * 1024 * 1024) return toast.error("Il video è troppo grande", { description: "Massimo 50 MB: registra circa 2 minuti." });
    setUploading(true);
    try {
      await uploadTrainingVideo(file);
      toast.success("Video caricato", { description: "Ora leggi e firma il consenso." });
    } catch (err) {
      toast.error("Video non caricato", { description: friendlyError(err) });
    }
    setUploading(false);
  }

  return (
    <div className="space-y-4 rounded-lg border px-4 py-4">
      <p className="text-[17px] font-semibold">Crea il tuo avatar in 2 passi</p>

      <div className={cn("rounded-lg p-4", step === 1 ? "bg-primary-soft/60" : "bg-muted")}>
        <p className="flex items-center gap-2 font-semibold">
          {step > 1 ? <Check className="size-5 text-success" aria-hidden /> : <span className="tabular-nums">1.</span>}
          Registra un video di te che parli
        </p>
        {step === 1 && (
          <>
            <ul className="mt-3 space-y-2 text-[15px]">
              {[
                "Luce: davanti a una finestra o una lampada, mai alle spalle.",
                "Inquadratura: telefono in verticale, all'altezza degli occhi, dal petto in su.",
                "Durata: circa 2 minuti, parlando con calma e guardando l'obiettivo.",
                "Sfondo semplice e stanza silenziosa, senza musica.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary-strong" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <input ref={fileRef} type="file" accept="video/*" capture="user" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button size="lg" className="mt-4 w-full sm:w-auto" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden />
              {uploading ? "Caricamento…" : "Carica o registra il video"}
            </Button>
          </>
        )}
      </div>

      <div className={cn("rounded-lg p-4", step === 2 ? "bg-primary-soft/60" : "bg-muted opacity-70")}>
        <p className="flex items-center gap-2 font-semibold">
          <span className="tabular-nums">2.</span>
          Leggi e firma il consenso
        </p>
        {step === 2 && <ConsentForm />}
      </div>
    </div>
  );
}

function ConsentForm() {
  const { agent, agency } = useAuth();
  const { data, loading, error, reload } = useQuery(activeConsent);
  const [name, setName] = useState(agent ? fullName(agent) : "");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = new Date();

  if (error) return <ErrorState message={error} onRetry={reload} className="mt-3" />;
  if (loading) return <Skeleton className="mt-3 h-40" />;
  if (!data)
    return (
      <p className="mt-3 rounded-lg bg-warning-soft px-4 py-3 text-[15px] text-warning">
        Il testo del consenso non è ancora disponibile: verrà pubblicato dopo la revisione legale. Riprova più tardi.
      </p>
    );

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return toast.error("Scrivi nome e cognome");
    if (!accepted) return toast.error("Conferma di aver letto il consenso");
    setBusy(true);
    try {
      const pdf = await buildConsentPdf({ text: data!.text, version: data!.version, signer: name.trim(), agencyName: agency?.name ?? "", signedAt: new Date() });
      await signConsent(data!.version, name.trim(), pdf);
      toast.success("Consenso firmato", { description: "Stiamo preparando il tuo avatar." });
    } catch (err) {
      toast.error("Consenso non firmato", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={sign} className="mt-3 space-y-4">
      <div className="max-h-72 overflow-y-auto whitespace-pre-line rounded-lg border bg-card p-4 text-[15px] leading-relaxed" tabIndex={0}>
        {data.text}
      </div>
      <p className="text-sm text-muted-foreground">Versione del testo: {data.version}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Field label="Nome e cognome" htmlFor="cons-name">
          <Input id="cons-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Data" htmlFor="cons-date">
          <Input id="cons-date" value={now.toLocaleDateString("it-IT")} readOnly />
        </Field>
      </div>
      <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border bg-card px-4 py-3">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-5 accent-primary" />
        <span>Ho letto il testo e acconsento all'uso della mia immagine e della mia voce per l'avatar dei video dell'agenzia.</span>
      </label>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy || !accepted}>
        <FileSignature aria-hidden />
        {busy ? "Firma in corso…" : "Firma il consenso"}
      </Button>
    </form>
  );
}

function RevokeDialog({ avatar, open, onOpenChange }: { avatar: AvatarProfile; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Revocare il consenso?" description={avatar.personName ? `Avatar di ${avatar.personName}` : undefined}>
        <ul className="mb-5 list-disc space-y-1 pl-5 text-[17px]">
          <li>L'avatar viene bloccato subito.</li>
          <li>Non si possono creare nuovi video con questo avatar.</li>
          <li>I video in preparazione vengono fermati.</li>
          <li>L'avatar viene cancellato anche presso il fornitore.</li>
        </ul>
        <Button
          variant="destructive"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await revokeConsent(avatar.id);
              toast.success("Consenso revocato");
              onOpenChange(false);
            } catch (err) {
              toast.error("Non revocato", { description: friendlyError(err) });
            }
            setBusy(false);
          }}
        >
          {busy ? "Un momento…" : "Sì, revoca il consenso"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/* =====================================================================
 * Brand
 * ===================================================================== */

function BrandSection() {
  const { data, loading, error, reload } = useQuery(async () => {
    const [brand, team] = await Promise.all([getBrand(), listTeam()]);
    return { brand, members: team.members.filter((m) => m.active) };
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stile dei video</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton className="h-96" /> : <BrandForm initial={data.brand} members={data.members} />}
      </CardContent>
    </Card>
  );
}

function BrandForm({ initial, members }: { initial: BrandSettings; members: Agent[] }) {
  const [b, setB] = useState<BrandSettings>(initial);
  const [tags, setTags] = useState(initial.fixedHashtags.join(" "));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof BrandSettings>(k: K, v: BrandSettings[K]) => setB((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!b.aiDisclaimer.trim()) return toast.error("La dicitura sull'AI è obbligatoria");
    setBusy(true);
    try {
      const fixedHashtags = tags
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((h) => (h.startsWith("#") ? h : `#${h}`));
      await updateBrand({ ...b, fixedHashtags });
      toast.success("Stile salvato");
    } catch (err) {
      toast.error("Non salvato", { description: friendlyError(err) });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-[15px] font-medium">Tono dei testi</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(toneLabel) as BrandTone[]).map((t) => (
            <label key={t} className={cn("cursor-pointer rounded-lg border px-4 py-3", b.tone === t && "border-primary bg-primary-soft/60")}>
              <input type="radio" name="tono" className="sr-only" checked={b.tone === t} onChange={() => set("tone", t)} />
              <span className="block font-semibold">{toneLabel[t].label}</span>
              <span className="block text-sm text-muted-foreground">{toneLabel[t].hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Frase di chiusura (facoltativa)" htmlFor="br-close" hint="La diciamo alla fine di ogni video. Es. «Chiamaci, ti aspettiamo in agenzia.»">
        <Input id="br-close" value={b.closingLine} onChange={(e) => set("closingLine", e.target.value)} />
      </Field>

      <Field label="Hashtag sempre presenti" htmlFor="br-tags" hint="Separati da uno spazio">
        <Input id="br-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#casa #bari" />
      </Field>

      <Field label="Dicitura sull'AI" htmlFor="br-ai" hint="Chiude sempre il testo di ogni post. Non si può togliere.">
        <Textarea id="br-ai" value={b.aiDisclaimer} onChange={(e) => set("aiDisclaimer", e.target.value)} className="min-h-20" />
      </Field>

      <PreferredTimes value={b.preferredTimes} onChange={(v) => set("preferredTimes", v)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Chi approva i video" htmlFor="br-appr" hint="Oltre al titolare, che può sempre approvare.">
          <Select id="br-appr" value={b.approverId ?? ""} onChange={(e) => set("approverId", e.target.value || null)}>
            <option value="">Solo il titolare</option>
            {members
              .filter((m) => m.role !== "titolare")
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {fullName(m)}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Colore del marchio" htmlFor="br-color">
          <div className="flex items-center gap-3">
            <input
              id="br-color"
              type="color"
              value={b.accentColor}
              onChange={(e) => set("accentColor", e.target.value.toUpperCase())}
              className="h-12 w-16 cursor-pointer rounded-lg border bg-card p-1"
            />
            <span className="font-mono text-[15px]">{b.accentColor}</span>
          </div>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-[15px] font-medium">Social proposti quando approvi</legend>
        <div className="flex flex-wrap gap-2">
          {(["instagram", "facebook", "tiktok"] as Platform[]).map((p) => {
            const on = b.defaultPlatforms.includes(p);
            return (
              <label key={p} className={cn("flex h-12 cursor-pointer items-center gap-2 rounded-lg border px-4", on && "border-primary bg-primary-soft/60")}>
                <input
                  type="checkbox"
                  checked={on}
                  className="size-5 accent-primary"
                  onChange={() => set("defaultPlatforms", on ? b.defaultPlatforms.filter((x) => x !== p) : [...b.defaultPlatforms, p])}
                />
                {platformLabel[p]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>
        <Check aria-hidden />
        {busy ? "Salvataggio…" : "Salva lo stile"}
      </Button>
    </form>
  );
}

function PreferredTimes({ value, onChange }: { value: BrandSettings["preferredTimes"]; onChange: (v: BrandSettings["preferredTimes"]) => void }) {
  const [adding, setAdding] = useState<string | null>(null);
  const [time, setTime] = useState("12:30");
  return (
    <fieldset>
      <legend className="mb-1 text-[15px] font-medium">Orari preferiti di pubblicazione</legend>
      <p className="mb-3 text-sm text-muted-foreground">Quando approvi un video ti proponiamo il primo di questi orari ancora libero.</p>
      <ul className="divide-y rounded-lg border">
        {weekDays.map((d) => {
          const times = [...(value[d.id] ?? [])].sort();
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="w-24 font-medium">{d.label}</span>
              {times.length === 0 && <span className="text-[15px] text-muted-foreground">Nessuno</span>}
              {times.map((t) => (
                <span key={t} className="inline-flex h-10 items-center gap-1 rounded-full bg-muted pl-3 pr-1 text-[15px] tabular-nums">
                  {t}
                  <button
                    type="button"
                    aria-label={`Togli ${t} di ${d.label}`}
                    onClick={() => onChange({ ...value, [d.id]: times.filter((x) => x !== t) })}
                    className="flex h-8 items-center gap-0.5 rounded-full px-2 text-sm text-muted-foreground hover:bg-background"
                  >
                    <X className="size-4" aria-hidden />
                    Togli
                  </button>
                </span>
              ))}
              {adding === d.id ? (
                <span className="flex items-center gap-2">
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-28" aria-label="Orario" />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (time && !times.includes(time)) onChange({ ...value, [d.id]: [...times, time].sort() });
                      setAdding(null);
                    }}
                  >
                    Aggiungi
                  </Button>
                </span>
              ) : (
                <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setAdding(d.id)}>
                  <Plus aria-hidden />
                  Orario
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/* =====================================================================
 * Account social e utilizzo
 * ===================================================================== */

function SocialSection() {
  const { data, loading, error, reload } = useQuery(listSocialAccounts);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account social</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading || !data ? (
          <Skeleton className="h-40" />
        ) : (
          <ul className="divide-y rounded-lg border">
            {(["instagram", "facebook", "tiktok"] as Platform[]).map((p) => {
              const acc = data.find((a) => a.platform === p);
              return (
                <li key={p} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{platformLabel[p]}</p>
                    <p className="text-sm text-muted-foreground">{acc ? acc.name : "Non collegato"}</p>
                  </div>
                  {acc && (
                    <Badge tone={acc.status === "collegato" ? "green" : acc.status === "scaduto" ? "orange" : "red"}>
                      {acc.status === "collegato" ? "Collegato" : acc.status === "scaduto" ? "Da ricollegare" : "Errore"}
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" disabled title="Disponibile a breve">
                    <Link2 aria-hidden />
                    {acc ? "Ricollega" : "Collega"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[15px] text-muted-foreground">
          Il collegamento degli account arriva a breve. Intanto puoi approvare e programmare i video: verranno pubblicati quando l'account sarà
          collegato.
        </p>
      </CardContent>
    </Card>
  );
}

function UsageSection() {
  const { agency } = useAuth();
  const { data, loading, error, reload } = useQuery(getUsage);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Utilizzo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading || !data ? (
          <Skeleton className="h-24" />
        ) : (
          <>
            <UsageBar usage={data} />
            <p className="text-[15px] text-muted-foreground">
              Piano {agency?.plan === "start" ? "Start" : agency?.plan === "elite" ? "Elite" : "Pro"}: {data.included} video inclusi al mese, al massimo{" "}
              {data.dailyLimit} generazioni ogni 24 ore.
              {data.extra > 0 && ` Video extra questo mese: ${data.extra}.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
