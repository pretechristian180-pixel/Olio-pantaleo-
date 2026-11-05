import "server-only";

import type { Tables } from "@nexora/shared";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Video = Tables<"videos">;
export type VideoVersion = Tables<"video_versions">;

export const MAX_CHANGE_ROUNDS = 2;

export const VIDEO_TABS = [
  {
    key: "montaggio",
    label: "In montaggio",
    statuses: ["queued", "editing", "changes_requested", "internal_review"],
  },
  { key: "approvare", label: "Da approvare", statuses: ["review"] },
  { key: "approvati", label: "Approvati", statuses: ["approved", "scheduled"] },
  { key: "pubblicati", label: "Pubblicati", statuses: ["published"] },
  { key: "problemi", label: "Con problemi", statuses: ["error"] },
] as const;

export type VideoTabKey = (typeof VIDEO_TABS)[number]["key"];

/** URL firmati in blocco per le copertine (bucket privato "output"). */
export async function signedOutputUrls(paths: (string | null)[], expiresIn = 3600) {
  const valid = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (!valid.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("output").createSignedUrls(valid, expiresIn);
  const map = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}

/** Video dell'azienda (RLS) con titolo dello script e copertina dell'ultima versione. */
export async function listVideos(workspaceId: string) {
  const supabase = await createClient();
  const { data: videos } = await supabase
    .from("videos")
    .select("*, script:scripts(title)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);
  const list = (videos ?? []) as (Video & { script: { title: string } | null })[];
  const ids = list.map((v) => v.id);
  const { data: versions } = ids.length
    ? await supabase
        .from("video_versions")
        .select("video_id, version, thumbnail_path, duration_s")
        .in("video_id", ids)
    : { data: [] };
  const latest = new Map<string, { thumbnail_path: string | null; duration_s: number | null }>();
  for (const v of versions ?? []) {
    const cur = list.find((x) => x.id === v.video_id);
    if (cur && v.version === cur.current_version) latest.set(v.video_id, v);
  }
  const urls = await signedOutputUrls([...latest.values()].map((v) => v.thumbnail_path));
  return list.map((v) => {
    const ver = latest.get(v.id);
    return {
      ...v,
      thumbnailUrl: ver?.thumbnail_path ? (urls.get(ver.thumbnail_path) ?? null) : null,
      durationS: ver?.duration_s ?? null,
    };
  });
}

export async function getVideoDetail(videoId: string) {
  const supabase = await createClient();
  const { data: video } = await supabase
    .from("videos")
    .select(
      "*, script:scripts(id, title, hook), raw:raw_uploads(file_name, duration_s, orientation, purged_at, created_at)",
    )
    .eq("id", videoId)
    .maybeSingle();
  if (!video) return null;
  const [{ data: versions }, { data: feedback }] = await Promise.all([
    supabase
      .from("video_versions")
      .select("*")
      .eq("video_id", videoId)
      .order("version", { ascending: false }),
    supabase.from("video_feedback").select("*").eq("video_id", videoId).order("created_at"),
  ]);
  const urls = await signedOutputUrls(
    (versions ?? []).flatMap((v) => [v.output_path, v.thumbnail_path]),
    4 * 3600,
  );
  return {
    video: video as Video & {
      script: { id: string; title: string; hook: string } | null;
      raw: {
        file_name: string;
        duration_s: number | null;
        orientation: string | null;
        purged_at: string | null;
        created_at: string;
      } | null;
    },
    versions: (versions ?? []).map((v) => ({
      ...v,
      videoUrl: v.output_path ? (urls.get(v.output_path) ?? null) : null,
      thumbnailUrl: v.thumbnail_path ? (urls.get(v.thumbnail_path) ?? null) : null,
    })),
    feedback: feedback ?? [],
  };
}

/** Fase di lavorazione per l'indicatore di avanzamento (la coda la legge solo il service role). */
export async function editingStage(
  videoId: string,
): Promise<"coda" | "trascrizione" | "montaggio" | "render"> {
  try {
    return await readEditingStage(videoId);
  } catch {
    return "coda";
  }
}

async function readEditingStage(
  videoId: string,
): Promise<"coda" | "trascrizione" | "montaggio" | "render"> {
  const { data } = await createAdminClient()
    .from("jobs")
    .select("type, status, payload, created_at")
    .eq("status", "running")
    .eq("payload->>video_id", videoId)
    .limit(1);
  const job = data?.[0];
  if (job?.type === "transcribe") return "trascrizione";
  if (job?.type === "edit") return "montaggio";
  const { data: renders } = await createAdminClient()
    .from("video_versions")
    .select("status")
    .eq("video_id", videoId)
    .eq("status", "pending")
    .limit(1);
  if (renders?.length) return "render";
  return "coda";
}

/** Link per scaricare il video finito (il browser lo salva invece di aprirlo). */
export async function downloadUrl(path: string, fileName: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("output")
    .createSignedUrl(path, 3600, { download: fileName });
  return data?.signedUrl ?? null;
}
