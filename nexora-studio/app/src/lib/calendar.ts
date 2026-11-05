import "server-only";

import { localParts, type SocialPlatform } from "@nexora/shared";

import { createClient } from "@/lib/supabase/server";
import { signedOutputUrls } from "@/lib/videos";

export interface CalendarItem {
  videoId: string;
  title: string;
  /** Data e ora locali dell'azienda. */
  date: string;
  time: string;
  scheduledAt: string;
  status: "scheduled" | "publishing" | "published" | "failed";
  platforms: SocialPlatform[];
  thumbnailUrl: string | null;
}

/** Post del calendario raggruppati per video, nel fuso dell'azienda. */
export async function getCalendar(workspaceId: string, from: Date, to: Date, timeZone: string) {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("scheduled_posts")
    .select("video_id, scheduled_at, status, account:social_accounts(platform)")
    .eq("workspace_id", workspaceId)
    .neq("status", "canceled")
    .gte("scheduled_at", from.toISOString())
    .lt("scheduled_at", to.toISOString())
    .order("scheduled_at");

  const byVideo = new Map<
    string,
    { at: string; statuses: string[]; platforms: SocialPlatform[] }
  >();
  for (const p of posts ?? []) {
    const cur = byVideo.get(p.video_id) ?? { at: p.scheduled_at, statuses: [], platforms: [] };
    cur.statuses.push(p.status);
    const platform = (p.account as { platform: SocialPlatform } | null)?.platform;
    if (platform) cur.platforms.push(platform);
    byVideo.set(p.video_id, cur);
  }
  const ids = [...byVideo.keys()];
  const { data: videos } = ids.length
    ? await supabase
        .from("videos")
        .select("id, current_version, script:scripts(title)")
        .in("id", ids)
    : { data: [] };
  const { data: versions } = ids.length
    ? await supabase
        .from("video_versions")
        .select("video_id, version, thumbnail_path")
        .in("video_id", ids)
    : { data: [] };
  const thumbs = new Map<string, string | null>();
  for (const v of videos ?? []) {
    thumbs.set(
      v.id,
      versions?.find((x) => x.video_id === v.id && x.version === v.current_version)
        ?.thumbnail_path ?? null,
    );
  }
  const urls = await signedOutputUrls([...thumbs.values()]);

  const items: CalendarItem[] = ids.map((id) => {
    const g = byVideo.get(id)!;
    const local = localParts(new Date(g.at), timeZone);
    const status: CalendarItem["status"] = g.statuses.includes("publishing")
      ? "publishing"
      : g.statuses.every((s) => s === "published")
        ? "published"
        : g.statuses.includes("failed") && !g.statuses.includes("scheduled")
          ? "failed"
          : g.statuses.includes("published")
            ? "published"
            : "scheduled";
    const v = videos?.find((x) => x.id === id);
    const thumb = thumbs.get(id);
    return {
      videoId: id,
      title: (v?.script as { title: string } | null)?.title ?? "Video libero",
      date: local.date,
      time: local.time,
      scheduledAt: g.at,
      status,
      platforms: [...new Set(g.platforms)],
      thumbnailUrl: thumb ? (urls.get(thumb) ?? null) : null,
    };
  });
  return items;
}

/** Video approvati ma non ancora in calendario. */
export async function getUnscheduled(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select("id, script:scripts(title)")
    .eq("workspace_id", workspaceId)
    .eq("status", "approved")
    .order("approved_at");
  return (data ?? []).map((v) => ({
    videoId: v.id,
    title: (v.script as { title: string } | null)?.title ?? "Video libero",
  }));
}

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};
