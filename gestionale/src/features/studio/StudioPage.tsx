import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Clapperboard, Search, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PropertyPhoto } from "@/components/shared/PropertyPhoto";
import { useAuth } from "@/features/auth/AuthProvider";
import { useQuery } from "@/hooks/useQuery";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listProperties } from "@/services/api";
import { getUsage, listVideos } from "@/services/studio";
import type { StudioUsage, VideoProject } from "@/types/studio";
import { CalendarView } from "./CalendarView";
import { videoStatus } from "./labels";

type Vista = "approvare" | "video" | "calendario";

/** Studio: video social degli immobili, da creare, approvare e programmare. */
export function StudioPage() {
  const [params, setParams] = useSearchParams();
  const vista = (params.get("vista") as Vista) || "approvare";
  const { isOwner } = useAuth();
  const [pickOpen, setPickOpen] = useState(false);
  const { data, loading, error, reload } = useQuery(listVideos);
  const usage = useQuery(getUsage);

  const videos = data ?? [];
  const toApprove = videos.filter((v) => v.status === "da_approvare");
  const others = videos.filter((v) => v.status !== "da_approvare");

  const createButton = (
    <Button size="lg" onClick={() => setPickOpen(true)}>
      <Clapperboard aria-hidden />
      Crea video
    </Button>
  );

  return (
    <div>
      <PageHeader title="Studio" subtitle="Video social dei tuoi immobili, con il tuo avatar" action={createButton} />

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        {usage.data ? <UsageBar usage={usage.data} /> : <Skeleton className="h-[92px]" />}
        {isOwner && (
          <Link
            to="/studio/impostazioni"
            className="flex items-center gap-3 rounded-lg border bg-card px-5 py-4 font-semibold shadow-card hover:border-primary/40"
          >
            <Settings2 className="size-5 text-primary-strong" aria-hidden />
            Impostazioni Studio
            <ChevronRight className="ml-auto size-5 text-muted-foreground" aria-hidden />
          </Link>
        )}
      </div>

      <Segmented
        label="Sezione di Studio"
        value={vista}
        onChange={(v) => setParams({ vista: v }, { replace: true })}
        className="mb-6"
        options={[
          { value: "approvare", label: "Da approvare", count: loading ? undefined : toApprove.length },
          { value: "video", label: "Video" },
          { value: "calendario", label: "Calendario" },
        ]}
      />

      {vista === "calendario" ? (
        <CalendarView />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : vista === "approvare" ? (
        toApprove.length === 0 ? (
          <EmptyState
            art="fatto"
            title="Nessun video da approvare"
            text="Quando un video è pronto lo trovi qui, e ti avvisiamo anche nella schermata Oggi."
            className="rounded-lg border"
          />
        ) : (
          <VideoGrid videos={toApprove} />
        )
      ) : others.length === 0 ? (
        <EmptyState
          art="casa"
          title="Ancora nessun video"
          text="Scegli un immobile: prepariamo noi il testo, tu controlli e approvi."
          action={createButton}
          className="rounded-lg border"
        />
      ) : (
        <VideoGrid videos={others} />
      )}

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent title="Di quale immobile facciamo il video?" description="Scegli l'immobile: le foto le prendiamo dalla sua scheda.">
          {pickOpen && <PropertyPicker />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function UsageBar({ usage, className }: { usage: StudioUsage; className?: string }) {
  const pct = usage.included ? Math.min(100, (usage.used / usage.included) * 100) : 100;
  const left = Math.max(0, usage.included - usage.used);
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-card", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[17px]">
          <strong className="tabular-nums">{usage.used}</strong> di <strong className="tabular-nums">{usage.included}</strong> video usati
          questo mese
        </p>
        <p className={cn("text-[15px]", pct >= 100 ? "font-semibold text-destructive" : pct >= 80 ? "font-semibold text-warning" : "text-muted-foreground")}>
          {pct >= 100 ? "Video inclusi finiti" : `Ne restano ${left}`}
        </p>
      </div>
      <Progress value={pct} className={cn("mt-3", pct >= 100 ? "[&>div]:bg-destructive" : pct >= 80 ? "[&>div]:bg-warning" : "")} />
      {pct >= 80 && (
        <p className="mt-2 text-[15px] text-muted-foreground">
          {pct >= 100
            ? "I prossimi video di questo mese saranno conteggiati come extra."
            : "Stai per finire i video inclusi nel tuo piano."}
        </p>
      )}
    </div>
  );
}

function VideoGrid({ videos }: { videos: VideoProject[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  );
}

export function VideoCard({ video: v }: { video: VideoProject }) {
  const s = videoStatus[v.status];
  return (
    <Link
      to={`/studio/video/${v.id}`}
      className="group flex min-w-0 gap-4 rounded-lg border bg-card p-3 shadow-card transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-md bg-muted">
        <PropertyPhoto photo={{ id: v.id, url: v.thumbUrl, scene: "soggiorno" }} kind="appartamento" tint={20} alt="" />
      </div>
      <div className="min-w-0 flex-1 py-1">
        <Badge tone={s.tone}>{s.label}</Badge>
        <p className="mt-2 truncate text-[17px] font-semibold group-hover:text-primary-strong">{v.property.address}</p>
        <p className="truncate text-muted-foreground">{v.property.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {v.duration} secondi · aggiornato {formatRelative(v.updatedAt)}
        </p>
        {v.status === "errore" && v.errorMessage && <p className="mt-1 line-clamp-2 text-sm text-destructive">{v.errorMessage}</p>}
      </div>
      <ChevronRight className="mt-8 size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function PropertyPicker() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data, loading, error, reload } = useQuery(() => listProperties({ query }), [query]);
  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per indirizzo o zona" aria-label="Cerca immobili" className="pl-11" />
      </div>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState art="ricerca" title="Nessun immobile trovato" text="Prova con un'altra ricerca." />
      ) : (
        <ul className="space-y-2">
          {data.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => navigate(`/studio/nuovo/${p.id}`)}
                className="flex w-full items-center gap-3 rounded-lg border bg-card p-2.5 text-left hover:border-primary/40"
              >
                <span className="h-14 w-18 shrink-0 overflow-hidden rounded-md bg-muted">
                  <PropertyPhoto photo={p.photos[0]} kind={p.kind} tint={p.tint} alt="" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.address}</span>
                  <span className="block truncate text-[15px] text-muted-foreground">
                    {p.title} · {p.photos.filter((ph) => !ph.id.endsWith("_segnaposto")).length} foto
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
