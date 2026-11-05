import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  CalendarClock,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-header";
import { VideoStatusBadge } from "@/components/layout/status-badge";
import { AutoRefresh } from "@/components/scripts/auto-refresh";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaptionForm, ChangeRequest } from "@/components/videos/review-actions";
import { scheduleVideoAction, unscheduleVideoAction } from "@/lib/actions/calendar";
import { approveVideo } from "@/lib/actions/videos";
import { PLATFORM_LABELS } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import type { SocialPlatform } from "@nexora/shared";
import { cn } from "@/lib/utils";
import { editingStage, getVideoDetail, MAX_CHANGE_ROUNDS } from "@/lib/videos";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Video" };

const UUID_RE = /^[0-9a-f-]{36}$/i;
const STAGES = [
  { key: "coda", label: "In coda" },
  { key: "trascrizione", label: "Ascoltiamo il girato" },
  { key: "montaggio", label: "Decidiamo i tagli" },
  { key: "render", label: "Montiamo il video" },
] as const;
const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
const postDateFmt = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});
const POST_BADGE = {
  scheduled: { label: "Programmato", variant: "info" },
  publishing: { label: "In pubblicazione", variant: "warning" },
  published: { label: "Pubblicato", variant: "success" },
  failed: { label: "Non pubblicato", variant: "destructive" },
  canceled: { label: "Annullato", variant: "secondary" },
} as const;

export default async function VideoDetailPage(props: PageProps<"/video/[id]">) {
  const { id } = await props.params;
  const ctx = await requireWorkspace();
  if (!UUID_RE.test(id)) notFound();
  const detail = await getVideoDetail(id);
  if (!detail || detail.video.workspace_id !== ctx.active.workspace.id) notFound();

  const { video, versions, feedback } = detail;
  const working = ["queued", "editing", "changes_requested", "internal_review"].includes(
    video.status,
  );
  const current =
    versions.find((v) => v.version === video.current_version && v.status === "ready") ?? null;
  const stage = working && video.status !== "internal_review" ? await editingStage(video.id) : null;
  const stageIndex = stage ? STAGES.findIndex((s) => s.key === stage) : -1;
  const clientFeedback = feedback.filter((f) => !f.message.startsWith("[Team Nexora]"));
  const supabase = await createClient();
  const { data: postRows } = await supabase
    .from("scheduled_posts")
    .select("id, scheduled_at, status, permalink, error, account:social_accounts(platform)")
    .eq("video_id", video.id)
    .neq("status", "canceled")
    .order("scheduled_at");
  const posts = (postRows ?? []).map((p) => ({
    ...p,
    platform: (p.account as { platform: SocialPlatform } | null)?.platform ?? "instagram",
  }));

  return (
    <PageContainer className="max-w-5xl">
      <Link
        href="/video"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Tutti i video
      </Link>

      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <VideoStatusBadge status={video.status} />
          {current && (
            <span className="text-xs text-muted-foreground">Versione {current.version}</span>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-balance sm:text-3xl">
          {video.script?.title ?? "Video libero"}
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start">
        {/* Player */}
        <div className="mx-auto w-full max-w-[380px]">
          {current?.videoUrl && !working ? (
            <video
              key={current.id}
              src={current.videoUrl}
              poster={current.thumbnailUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-full rounded-2xl border bg-black"
            >
              <track kind="captions" />
            </video>
          ) : (
            <div className="relative flex aspect-[9/16] w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border bg-card p-6 text-center">
              <div className="pointer-events-none absolute inset-0 bg-aurora" aria-hidden />
              {video.status === "error" ? (
                <AlertTriangle className="relative size-10 text-destructive" aria-hidden />
              ) : (
                <Loader2 className="relative size-10 animate-spin text-primary-text" aria-hidden />
              )}
              <p className="relative font-display text-lg font-semibold">
                {video.status === "error"
                  ? "Montaggio non riuscito"
                  : video.status === "changes_requested"
                    ? "Stiamo preparando la nuova versione"
                    : "Stiamo montando il tuo video"}
              </p>
              {video.status !== "error" && (
                <p className="relative text-sm text-muted-foreground">
                  Di solito bastano pochi minuti. Ti mandiamo un&apos;email quando è pronto.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-5">
          {working && (
            <Card>
              <CardContent className="grid gap-3" role="status">
                <ol className="grid gap-2.5">
                  {STAGES.map((s, i) => {
                    const done = video.status === "internal_review" || i < stageIndex;
                    const active = i === stageIndex;
                    return (
                      <li key={s.key} className="flex items-center gap-3 text-sm">
                        <span
                          className={cn(
                            "flex size-6 items-center justify-center rounded-full border text-xs",
                            done && "border-transparent bg-success text-white",
                            active && "border-nx-blue-500 text-primary-text",
                          )}
                        >
                          {done ? (
                            <Check className="size-3.5" aria-hidden />
                          ) : active ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <span
                          className={cn(
                            !done && !active && "text-muted-foreground",
                            active && "font-medium",
                          )}
                        >
                          {s.label}
                        </span>
                      </li>
                    );
                  })}
                  {video.status === "internal_review" && (
                    <li className="flex items-center gap-3 text-sm font-medium">
                      <span className="flex size-6 items-center justify-center rounded-full border border-nx-blue-500 text-primary-text">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      </span>
                      Ultimo controllo del team Nexora
                    </li>
                  )}
                </ol>
                <AutoRefresh seconds={6} />
              </CardContent>
            </Card>
          )}

          {video.status === "error" && (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertTitle>Non siamo riusciti a montare questo video</AlertTitle>
              <AlertDescription className="grid gap-3">
                <p>
                  {video.error ?? "Il nostro team è stato avvisato."} Il video non è stato
                  conteggiato nel tuo piano.
                </p>
                <Button variant="outline" size="sm" asChild className="w-fit">
                  <Link href="/video/carica">
                    <Upload aria-hidden /> Carica di nuovo
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {video.status === "review" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ti piace?</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {video.error && (
                  <Alert variant="warning">
                    <AlertTriangle aria-hidden />
                    <AlertDescription className="text-foreground">{video.error}</AlertDescription>
                  </Alert>
                )}
                <form action={approveVideo} className="grid">
                  <input type="hidden" name="video_id" value={video.id} />
                  <SubmitButton variant="brand" size="lg" pendingLabel="Approvo…">
                    <CheckCircle2 aria-hidden /> Approva il video
                  </SubmitButton>
                </form>
                <ChangeRequest
                  videoId={video.id}
                  remaining={MAX_CHANGE_ROUNDS - video.change_rounds_used}
                />
                <p className="text-xs text-muted-foreground">
                  Niente viene pubblicato senza la tua approvazione.
                </p>
              </CardContent>
            </Card>
          )}

          {["approved", "scheduled", "published"].includes(video.status) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pubblicazione</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {posts.length > 0 ? (
                  <>
                    <p className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-primary-text" aria-hidden />
                      <span>
                        {video.status === "published" ? "Pubblicato" : "Esce"}{" "}
                        <strong>{postDateFmt.format(new Date(posts[0]!.scheduled_at))}</strong>
                      </span>
                    </p>
                    <ul className="grid gap-1.5">
                      {posts.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        >
                          <span>{PLATFORM_LABELS[p.platform]}</span>
                          {p.status === "published" && p.permalink ? (
                            <a
                              href={p.permalink}
                              target="_blank"
                              rel="noopener"
                              className="text-xs font-medium text-primary-text hover:underline"
                            >
                              Vedi il post
                            </a>
                          ) : (
                            <Badge variant={POST_BADGE[p.status].variant}>
                              {POST_BADGE[p.status].label}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                    {posts.some((p) => p.error) && (
                      <p className="text-xs text-destructive">
                        {posts.find((p) => p.error)?.error}
                      </p>
                    )}
                    {video.status === "scheduled" &&
                      posts.every((p) => p.status === "scheduled") && (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href="/calendario">Sposta nel calendario</Link>
                          </Button>
                          <form action={unscheduleVideoAction}>
                            <input type="hidden" name="video_id" value={video.id} />
                            <Button variant="ghost" size="sm" type="submit">
                              Togli dal calendario
                            </Button>
                          </form>
                        </div>
                      )}
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      Video approvato
                      {video.approved_at
                        ? ` il ${dateFmt.format(new Date(video.approved_at))}`
                        : ""}
                      . Non è ancora in calendario.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <form action={scheduleVideoAction}>
                        <input type="hidden" name="video_id" value={video.id} />
                        <Button size="sm" type="submit">
                          Programma nel primo spazio libero
                        </Button>
                      </form>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/social">Collega i social</Link>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {(current || video.caption) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Didascalia e hashtag</CardTitle>
              </CardHeader>
              <CardContent>
                <CaptionForm
                  videoId={video.id}
                  caption={video.caption ?? ""}
                  hashtags={video.hashtags}
                  editable={["review", "approved", "scheduled"].includes(video.status)}
                />
              </CardContent>
            </Card>
          )}

          {video.script && (
            <Link
              href={`/script/${video.script.id}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm hover:border-nx-blue-500/50"
            >
              <FileText className="size-4 text-primary-text" aria-hidden />
              <span className="min-w-0 flex-1 truncate">Script: «{video.script.hook}»</span>
            </Link>
          )}

          {(versions.filter((v) => v.status === "ready").length > 1 ||
            clientFeedback.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Versioni e modifiche</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-3">
                  {versions
                    .filter((v) => v.status === "ready")
                    .map((v) => {
                      const fb = clientFeedback.find((f) => f.id === v.feedback_id);
                      return (
                        <li key={v.id} className="grid gap-1 rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">Versione {v.version}</span>
                            {v.videoUrl && (
                              <a
                                href={v.videoUrl}
                                target="_blank"
                                rel="noopener"
                                className="text-xs font-medium text-primary-text hover:underline"
                              >
                                Guarda
                              </a>
                            )}
                          </div>
                          {fb && <p className="text-muted-foreground">Richiesta: «{fb.message}»</p>}
                        </li>
                      );
                    })}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
