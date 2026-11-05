import Link from "next/link";
import { Clapperboard } from "lucide-react";

import { VideoStatusBadge } from "@/components/layout/status-badge";
import type { VideoStatus } from "@nexora/shared";

/** Card video 9:16 con copertina, titolo dello script e stato. */
export function VideoCard({
  id,
  title,
  status,
  thumbnailUrl,
  durationS,
}: {
  id: string;
  title: string;
  status: VideoStatus;
  thumbnailUrl: string | null;
  durationS: number | null;
}) {
  return (
    <Link href={`/video/${id}`} className="group grid gap-2.5">
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl border bg-muted">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmato a scadenza
          <img
            src={thumbnailUrl}
            alt=""
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-aurora text-muted-foreground">
            <Clapperboard className="size-8" aria-hidden />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <VideoStatusBadge status={status} />
        </div>
        {durationS ? (
          <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
            {Math.floor(durationS / 60)}:{String(Math.round(durationS % 60)).padStart(2, "0")}
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2 text-sm font-medium">{title}</p>
    </Link>
  );
}
