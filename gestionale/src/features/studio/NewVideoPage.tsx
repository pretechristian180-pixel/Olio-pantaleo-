import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clapperboard, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PropertyPhoto } from "@/components/shared/PropertyPhoto";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { getProperty } from "@/services/api";
import { generateScript, getUsage, getVideo, listAvatars, saveVideo, startGeneration, type ScriptProposal } from "@/services/studio";
import type { Property, PropertyPhoto as Photo } from "@/types/domain";
import type { Duration, VideoProject } from "@/types/studio";
import { MAX_PHOTOS, MIN_PHOTOS } from "./labels";
import { estimateSeconds } from "./ReelPlayer";

type Step = 1 | 2 | 3;

/**
 * Creazione di un video in 3 passi: Foto → Testo → Riepilogo.
 * Con `/studio/video/:id/modifica` riapre un video esistente (es. dopo "Chiedi modifiche").
 */
export function NewVideoPage() {
  const { propertyId, id: videoId } = useParams();
  const { data, loading, error, reload } = useQuery(async () => {
    const existing = videoId ? await getVideo(videoId) : null;
    const pid = existing?.video.propertyId ?? propertyId ?? "";
    const detail = await getProperty(pid);
    return { existing, property: detail?.property ?? null };
  }, [propertyId, videoId]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-[480px]" />;
  if (!data.property)
    return (
      <EmptyState
        art="casa"
        title="Immobile non trovato"
        action={
          <Button asChild>
            <Link to="/studio">Torna a Studio</Link>
          </Button>
        }
      />
    );
  return <Wizard property={data.property} existing={data.existing?.video} />;
}

function Wizard({ property: p, existing }: { property: Property; existing?: VideoProject }) {
  const navigate = useNavigate();
  const realPhotos = p.photos.filter((ph) => !ph.id.endsWith("_segnaposto"));
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<string[]>(
    existing?.photoIds.length ? existing.photoIds.filter((id) => realPhotos.some((ph) => ph.id === id)) : realPhotos.slice(0, 8).map((ph) => ph.id),
  );
  const [duration, setDuration] = useState<Duration>(existing?.duration ?? 45);
  const [script, setScript] = useState({
    intro: existing?.intro ?? "",
    outro: existing?.outro ?? "",
    caption: existing?.caption ?? "",
    hashtags: existing?.hashtags.join(" ") ?? "",
  });
  const [meta, setMeta] = useState<Pick<ScriptProposal, "source" | "warning"> | null>(null);
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>(existing?.id);
  const [lowRes, setLowRes] = useState<Set<string>>(new Set());

  async function writeScript() {
    setWriting(true);
    try {
      const s = await generateScript(p.id, duration);
      setScript({ intro: s.intro, outro: s.outro, caption: s.caption, hashtags: s.hashtags.join(" ") });
      setMeta({ source: s.source, warning: s.warning });
    } catch (err) {
      toast.error("Testo non pronto", { description: friendlyError(err) });
    }
    setWriting(false);
  }

  useEffect(() => {
    if (step === 2 && !script.intro && !script.outro && !writing) void writeScript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const hashtags = script.hashtags
    .split(/[\s,]+/)
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.startsWith("#") ? h : `#${h}`));
  const scriptOk = script.intro.trim().length > 0 && script.outro.trim().length > 0;

  async function generate() {
    setBusy(true);
    try {
      const id = await saveVideo(
        { propertyId: p.id, duration, photoIds: selected, intro: script.intro, outro: script.outro, caption: script.caption, hashtags },
        savedId,
      );
      setSavedId(id);
      await startGeneration(id);
      toast.success("Stiamo preparando il video", { description: "Ci vuole qualche minuto: ti avvisiamo quando è pronto da approvare." });
      navigate(`/studio/video/${id}`, { replace: true });
    } catch (err) {
      toast.error("Video non avviato", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to={existing ? `/studio/video/${existing.id}` : "/studio"} label={existing ? "Torna al video" : "Studio"} />
      <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">{existing ? "Modifica il video" : "Nuovo video"}</h1>
      <p className="mt-1 text-[17px] text-muted-foreground">{p.address}, {p.city}</p>

      <ol className="my-6 grid grid-cols-3 gap-2" aria-label="Passaggi">
        {(["Foto", "Testo", "Riepilogo"] as const).map((label, i) => {
          const n = (i + 1) as Step;
          return (
            <li
              key={label}
              aria-current={n === step ? "step" : undefined}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-lg border text-[15px] font-semibold",
                n === step ? "border-primary bg-primary-soft text-primary-strong" : n < step ? "bg-card text-foreground" : "bg-card text-muted-foreground",
              )}
            >
              {n < step ? <Check className="size-4 text-success" aria-hidden /> : <span className="tabular-nums">{n}</span>}
              {label}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <PhotoStep
          photos={realPhotos}
          property={p}
          selected={selected}
          onChange={setSelected}
          lowRes={lowRes}
          onLowRes={(id) => setLowRes((s) => new Set(s).add(id))}
        />
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Field label="Durata del video">
            <Segmented
              label="Durata"
              value={String(duration) as "30" | "45" | "60"}
              onChange={(v) => setDuration(Number(v) as Duration)}
              options={[
                { value: "30", label: "30 secondi" },
                { value: "45", label: "45 secondi" },
                { value: "60", label: "60 secondi" },
              ]}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={writeScript} disabled={writing}>
              <RefreshCw aria-hidden className={cn(writing && "animate-spin")} />
              {writing ? "Sto scrivendo…" : "Rigenera il testo"}
            </Button>
            {meta?.source === "ai" && (
              <Badge tone="brand">
                <Sparkles className="size-3.5" aria-hidden />
                Scritto dall'AI con i dati della scheda
              </Badge>
            )}
            {meta?.source === "modello" && <Badge tone="gray">Testo di base con i dati della scheda</Badge>}
          </div>
          {meta?.warning && <p className="rounded-lg bg-warning-soft px-4 py-3 text-[15px] text-warning">{meta.warning}</p>}
          {writing && !scriptOk ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-40" />
            </div>
          ) : (
            <>
              <Field label="Cosa dici all'inizio (il tuo avatar)" htmlFor="sc-intro" hint={`${words(script.intro)} parole`}>
                <Textarea id="sc-intro" value={script.intro} onChange={(e) => setScript((s) => ({ ...s, intro: e.target.value }))} className="min-h-28" />
              </Field>
              <Field label="Cosa dici alla fine (il tuo avatar)" htmlFor="sc-outro" hint={`${words(script.outro)} parole`}>
                <Textarea id="sc-outro" value={script.outro} onChange={(e) => setScript((s) => ({ ...s, outro: e.target.value }))} className="min-h-24" />
              </Field>
              <Field label="Testo del post (caption)" htmlFor="sc-caption">
                <Textarea id="sc-caption" value={script.caption} onChange={(e) => setScript((s) => ({ ...s, caption: e.target.value }))} />
              </Field>
              <Field label="Hashtag" htmlFor="sc-tags" hint="Separati da uno spazio. Quelli fissi dell'agenzia si aggiungono da soli.">
                <Input id="sc-tags" value={script.hashtags} onChange={(e) => setScript((s) => ({ ...s, hashtags: e.target.value }))} />
              </Field>
              <p className="text-[15px] text-muted-foreground">
                Controlla che il testo dica solo cose vere dell'immobile: niente caratteristiche che non sono nella scheda.
              </p>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <Summary
          property={p}
          photos={selected.map((id) => realPhotos.find((ph) => ph.id === id)!).filter(Boolean)}
          intro={script.intro}
          outro={script.outro}
          duration={duration}
        />
      )}

      <div className="sticky bottom-[84px] z-10 mt-8 flex gap-3 border-t bg-background/95 py-3 backdrop-blur lg:bottom-0">
        {step > 1 && (
          <Button variant="outline" size="lg" onClick={() => setStep((s) => (s - 1) as Step)} disabled={busy}>
            <ArrowLeft aria-hidden />
            Indietro
          </Button>
        )}
        {step < 3 ? (
          <Button
            size="lg"
            className="flex-1"
            disabled={(step === 1 && selected.length === 0) || (step === 2 && (!scriptOk || writing))}
            onClick={() => setStep((s) => (s + 1) as Step)}
          >
            Avanti
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={generate} disabled={busy}>
            <Clapperboard aria-hidden />
            {busy ? "Avvio in corso…" : "Genera video"}
          </Button>
        )}
      </div>
    </div>
  );
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/* ---------- Passo 1: foto ---------- */

function PhotoStep({
  photos,
  property: p,
  selected,
  onChange,
  lowRes,
  onLowRes,
}: {
  photos: Photo[];
  property: Property;
  selected: string[];
  onChange: (ids: string[]) => void;
  lowRes: Set<string>;
  onLowRes: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(photos.map((ph) => [ph.id, ph]));
  const others = photos.filter((ph) => !selected.includes(ph.id));

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    onChange(arrayMove(selected, selected.indexOf(String(e.active.id)), selected.indexOf(String(e.over.id))));
  }

  if (photos.length === 0)
    return (
      <EmptyState
        art="casa"
        title="Questo immobile non ha foto"
        text="Il video usa solo le foto reali dell'immobile: aggiungile alla scheda e poi torna qui."
        action={
          <Button asChild>
            <Link to={`/immobili/${p.id}`}>Apri la scheda</Link>
          </Button>
        }
        className="rounded-lg border"
      />
    );

  return (
    <div>
      <p className="text-[17px]">
        Scegli le foto e mettile in ordine: <strong>ne consigliamo da 6 a 10</strong>. Tieni premuta una foto e trascinala per spostarla.
      </p>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Nel video le foto restano identiche alla realtà: si muovono solo con zoom lenti e panoramiche.
      </p>

      {selected.length > 0 && selected.length < MIN_PHOTOS && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-[15px] text-warning">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          Con meno di {MIN_PHOTOS} foto il video risulta corto e ripetitivo. Se puoi, aggiungine altre.
        </p>
      )}
      {selected.some((id) => lowRes.has(id)) && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-[15px] text-warning">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          Alcune foto hanno una risoluzione bassa e nel video potrebbero sembrare sfocate.
        </p>
      )}

      <h2 className="mb-3 mt-6 text-lg font-semibold">
        Nel video <span className="text-muted-foreground">({selected.length})</span>
      </h2>
      {selected.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">Aggiungi almeno una foto qui sotto.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={selected} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {selected.map((id, i) => {
                const ph = byId.get(id);
                if (!ph) return null;
                return (
                  <SortablePhoto
                    key={id}
                    photo={ph}
                    index={i}
                    property={p}
                    low={lowRes.has(id)}
                    onLowRes={() => onLowRes(id)}
                    onRemove={() => onChange(selected.filter((x) => x !== id))}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {others.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold">Altre foto dell'immobile</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {others.map((ph) => (
              <li key={ph.id} className="overflow-hidden rounded-lg border bg-card">
                <div className="aspect-[4/3] bg-muted opacity-80">
                  <PropertyPhoto photo={ph} kind={p.kind} tint={p.tint} alt="" />
                </div>
                <Button
                  variant="ghost"
                  className="w-full rounded-none"
                  disabled={selected.length >= MAX_PHOTOS}
                  onClick={() => onChange([...selected, ph.id])}
                >
                  <Plus aria-hidden />
                  Aggiungi
                </Button>
              </li>
            ))}
          </ul>
          {selected.length >= MAX_PHOTOS && <p className="mt-2 text-[15px] text-muted-foreground">Massimo {MAX_PHOTOS} foto per video.</p>}
        </>
      )}
    </div>
  );
}

function SortablePhoto({
  photo,
  index,
  property: p,
  low,
  onLowRes,
  onRemove,
}: {
  photo: Photo;
  index: number;
  property: Property;
  low: boolean;
  onLowRes: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}
      className={cn("overflow-hidden rounded-lg border bg-card shadow-card", isDragging && "z-10 shadow-raised ring-2 ring-primary")}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`Foto ${index + 1}: trascina per spostarla`}
        className="relative aspect-[4/3] cursor-grab touch-none bg-muted active:cursor-grabbing"
      >
        {photo.url ? (
          <img
            src={photo.url}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (Math.min(img.naturalWidth, img.naturalHeight) < 720) onLowRes();
            }}
            className="h-full w-full object-cover"
          />
        ) : (
          <PropertyPhoto photo={photo} kind={p.kind} tint={p.tint} alt="" />
        )}
        <span className="absolute left-2 top-2 flex size-8 items-center justify-center rounded-full bg-foreground text-[15px] font-bold text-white">
          {index + 1}
        </span>
        {low && <span className="absolute bottom-2 left-2 rounded-full bg-warning px-2 py-0.5 text-[13px] font-semibold text-white">Bassa risoluzione</span>}
      </div>
      <Button variant="ghost" className="w-full rounded-none text-muted-foreground" onClick={onRemove}>
        <X aria-hidden />
        Togli
      </Button>
    </li>
  );
}

/* ---------- Passo 3: riepilogo ---------- */

function Summary({ property: p, photos, intro, outro, duration }: { property: Property; photos: Photo[]; intro: string; outro: string; duration: Duration }) {
  const usage = useQuery(getUsage);
  const avatars = useQuery(listAvatars);
  const seconds = estimateSeconds(intro, outro, photos.length, duration);
  const ready = avatars.data?.some((a) => a.status === "pronto");
  const left = usage.data ? Math.max(0, usage.data.included - usage.data.used) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold">Come sarà il video</h2>
          <ol className="space-y-3">
            <SummaryRow n={1} title="Il tuo avatar presenta l'immobile" text={`"${intro.trim().slice(0, 90)}${intro.trim().length > 90 ? "…" : ""}"`} />
            <SummaryRow n={2} title={`${photos.length} foto reali con movimenti di camera`} text="Zoom lento, panoramica e parallasse leggera. Nessuna modifica agli ambienti.">
              <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
                {photos.map((ph) => (
                  <span key={ph.id} className="h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
                    <PropertyPhoto photo={ph} kind={p.kind} tint={p.tint} alt="" />
                  </span>
                ))}
              </div>
            </SummaryRow>
            <SummaryRow n={3} title="Il tuo avatar chiude con logo e contatti" text={`"${outro.trim().slice(0, 90)}${outro.trim().length > 90 ? "…" : ""}"`} />
          </ol>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <p className="text-3xl font-bold tabular-nums leading-none">~{seconds}"</p>
          <p className="mt-2 text-[15px] text-muted-foreground">durata stimata, formato verticale 9:16</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <p className="text-3xl font-bold tabular-nums leading-none">{left ?? "–"}</p>
          <p className="mt-2 text-[15px] text-muted-foreground">video inclusi rimasti questo mese</p>
        </div>
      </div>
      {left === 0 && (
        <p className="rounded-lg bg-warning-soft px-4 py-3 text-[15px] text-warning">Hai usato tutti i video inclusi: questo sarà conteggiato come extra.</p>
      )}
      {avatars.data && !ready && (
        <p className="flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-[15px] text-destructive">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            Serve un avatar pronto, con il consenso firmato.{" "}
            <Link to="/studio/impostazioni" className="font-semibold underline">
              Completalo nelle impostazioni di Studio
            </Link>
            .
          </span>
        </p>
      )}
      <p className="text-[15px] text-muted-foreground">
        Il video si prepara da solo: puoi chiudere questa pagina. Ti avvisiamo quando è pronto da approvare.
      </p>
    </div>
  );
}

function SummaryRow({ n, title, text, children }: { n: number; title: string; text: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-strong">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-[15px] text-muted-foreground">{text}</p>
        {children}
      </div>
    </li>
  );
}
