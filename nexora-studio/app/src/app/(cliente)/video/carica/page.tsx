import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Uploader } from "@/components/videos/uploader";
import { defaultWeek, getBatchScripts, listBatches } from "@/lib/scripts";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Carica il video" };

export default async function CaricaPage(props: PageProps<"/video/carica">) {
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;
  const { script } = await props.searchParams;

  const trialOver = !ws.plan_id && ws.trial_videos_left <= 0;

  // Script ancora da girare della settimana mostrata (più quello indicato nel link)
  const week = await defaultWeek(ws.id);
  const batch = (await listBatches(ws.id, 2)).find((b) => b.week_start === week);
  const scripts = batch
    ? (await getBatchScripts(batch.id)).filter((s) => s.status === "to_shoot" || s.id === script)
    : [];
  const defaultScriptId =
    typeof script === "string" && scripts.some((s) => s.id === script) ? script : null;

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title="Carica il video"
        description="Scegli il video dal telefono o dal computer. Al montaggio pensiamo noi."
      />
      {trialOver ? (
        <EmptyState
          icon={CreditCard}
          title="Hai usato i 3 video della prova"
          description="Scegli un piano per continuare a ricevere i video montati ogni settimana."
          action={
            <Button variant="brand" asChild>
              <Link href="/piano">Scegli il piano</Link>
            </Button>
          }
        />
      ) : (
        <Uploader
          workspaceId={ws.id}
          scripts={scripts.map((s) => ({ id: s.id, title: s.title }))}
          defaultScriptId={defaultScriptId}
        />
      )}
    </PageContainer>
  );
}
