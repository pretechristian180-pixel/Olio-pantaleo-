import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { SubmitButton } from "@/components/forms/submit-button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AutoRefresh } from "@/components/scripts/auto-refresh";
import { Card, CardContent } from "@/components/ui/card";
import { adminSendToClient } from "@/lib/actions/videos";
import { createClient } from "@/lib/supabase/server";
import { signedOutputUrls } from "@/lib/videos";

import { ReworkForm } from "./rework-form";

export const metadata: Metadata = { title: "Revisione video", robots: { index: false } };

/** Video in controllo interno (manual_review) di tutte le aziende. Lettura con RLS admin. */
export default async function AdminReviewPage() {
  const supabase = await createClient();
  const { data: videos } = await supabase
    .from("videos")
    .select("*, workspace:workspaces(name, city), script:scripts(title, hook)")
    .eq("status", "internal_review")
    .order("updated_at");
  const ids = (videos ?? []).map((v) => v.id);
  const { data: versions } = ids.length
    ? await supabase.from("video_versions").select("*").in("video_id", ids).eq("status", "ready")
    : { data: [] };
  const current = new Map(
    (videos ?? []).map((v) => [
      v.id,
      (versions ?? []).find((x) => x.video_id === v.id && x.version === v.current_version),
    ]),
  );
  const urls = await signedOutputUrls(
    [...current.values()].flatMap((v) => [v?.output_path ?? null, v?.thumbnail_path ?? null]),
    4 * 3600,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Revisione video"
        description="Video montati in attesa di controllo prima dell'invio al cliente (aziende con revisione manuale)."
      />
      {!videos?.length ? (
        <EmptyState
          icon={ShieldCheck}
          title="Niente da controllare"
          description="I nuovi video in revisione compaiono qui e ti arriva un'email."
        />
      ) : (
        <ul className="grid gap-5">
          {videos.map((v) => {
            const ver = current.get(v.id);
            const spec = (ver?.edit_spec ?? {}) as {
              _plan?: { notes?: string };
              segments?: unknown[];
              music?: { trackId: string } | null;
            };
            const ws = v.workspace as { name: string; city: string | null } | null;
            const script = v.script as { title: string; hook: string } | null;
            return (
              <li key={v.id}>
                <Card>
                  <CardContent className="grid gap-5 md:grid-cols-[240px_1fr]">
                    {ver?.output_path && urls.get(ver.output_path) ? (
                      <video
                        src={urls.get(ver.output_path)}
                        poster={ver.thumbnail_path ? urls.get(ver.thumbnail_path) : undefined}
                        controls
                        playsInline
                        preload="metadata"
                        className="aspect-[9/16] w-full rounded-xl bg-black"
                      >
                        <track kind="captions" />
                      </video>
                    ) : (
                      <div className="aspect-[9/16] rounded-xl bg-muted" />
                    )}
                    <div className="grid content-start gap-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-primary-text uppercase">
                          {ws?.name}
                          {ws?.city ? ` · ${ws.city}` : ""}
                        </p>
                        <p className="font-display text-lg font-semibold">
                          {script?.title ?? "Video libero"}
                        </p>
                        <p className="text-muted-foreground">
                          Versione {v.current_version} · {ver?.duration_s ?? "?"} s · render{" "}
                          {ver?.render_ms ? Math.round(ver.render_ms / 1000) : "?"} s ·{" "}
                          {spec.segments?.length ?? 0} tagli · musica{" "}
                          {spec.music?.trackId ?? "nessuna"}
                        </p>
                      </div>
                      {spec._plan?.notes && (
                        <p className="rounded-lg bg-muted p-3">
                          <span className="font-medium">Note del montaggio:</span>{" "}
                          {spec._plan.notes}
                        </p>
                      )}
                      {v.caption && (
                        <p className="whitespace-pre-line">
                          {v.caption}
                          <span className="block text-primary-text">
                            {v.hashtags.map((h) => `#${h}`).join(" ")}
                          </span>
                        </p>
                      )}
                      <form action={adminSendToClient}>
                        <input type="hidden" name="video_id" value={v.id} />
                        <SubmitButton variant="brand" pendingLabel="Invio…">
                          Invia al cliente
                        </SubmitButton>
                      </form>
                      <ReworkForm videoId={v.id} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <AutoRefresh seconds={30} />
    </PageContainer>
  );
}
