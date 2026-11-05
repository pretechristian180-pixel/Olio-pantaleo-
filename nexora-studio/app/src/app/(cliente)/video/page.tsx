import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, Upload } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AutoRefresh } from "@/components/scripts/auto-refresh";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/videos/video-card";
import { cn } from "@/lib/utils";
import { listVideos, VIDEO_TABS, type VideoTabKey } from "@/lib/videos";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Video" };

export default async function VideoPage(props: PageProps<"/video">) {
  const ctx = await requireWorkspace();
  const { stato } = await props.searchParams;
  const videos = await listVideos(ctx.active.workspace.id);

  const counts = Object.fromEntries(
    VIDEO_TABS.map((t) => [
      t.key,
      videos.filter((v) => (t.statuses as readonly string[]).includes(v.status)).length,
    ]),
  ) as Record<VideoTabKey, number>;
  const requested = VIDEO_TABS.find((t) => t.key === stato);
  const tab =
    requested ??
    (counts.approvare ? VIDEO_TABS[1] : (VIDEO_TABS.find((t) => counts[t.key]) ?? VIDEO_TABS[0]));
  const shown = videos.filter((v) => (tab.statuses as readonly string[]).includes(v.status));
  const working = videos.some((v) =>
    ["queued", "editing", "changes_requested", "internal_review"].includes(v.status),
  );

  return (
    <PageContainer>
      <PageHeader
        title="Video"
        description="I tuoi video: in montaggio, da approvare, approvati e pubblicati."
        actions={
          <Button variant="brand" asChild>
            <Link href="/video/carica">
              <Upload aria-hidden /> Carica il video
            </Link>
          </Button>
        }
      />
      {videos.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="Ancora nessun video"
          description="Carica il primo girato: lo montiamo noi e te lo mandiamo da approvare."
          action={
            <Button variant="outline" asChild>
              <Link href="/video/carica">Carica il video</Link>
            </Button>
          }
        />
      ) : (
        <>
          <nav aria-label="Stato dei video" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex gap-2">
              {VIDEO_TABS.filter((t) => t.key !== "problemi" || counts.problemi).map((t) => (
                <li key={t.key}>
                  <Link
                    href={`/video?stato=${t.key}`}
                    aria-current={t.key === tab.key ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground",
                      t.key === tab.key && "border-nx-blue-500 bg-accent text-accent-foreground",
                    )}
                  >
                    {t.label}
                    <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
                      {counts[t.key]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {shown.length ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((v) => (
                <li key={v.id}>
                  <VideoCard
                    id={v.id}
                    title={v.script?.title ?? "Video libero"}
                    status={v.status}
                    thumbnailUrl={v.thumbnailUrl}
                    durationS={v.durationS}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nessun video in questa sezione.
            </p>
          )}
        </>
      )}
      {working && <AutoRefresh seconds={10} />}
    </PageContainer>
  );
}
