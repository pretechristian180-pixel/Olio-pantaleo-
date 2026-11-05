import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Video } from "lucide-react";

import { GraceAlert } from "@/components/billing/grace-alert";
import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Uploader } from "@/components/videos/uploader";
import { BLOCK_MESSAGES, getPlanUsage } from "@/lib/billing";
import { defaultWeek, getBatchScripts, listBatches } from "@/lib/scripts";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Carica il video" };

export default async function CaricaPage(props: PageProps<"/video/carica">) {
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;
  const { script } = await props.searchParams;

  const { blocked, graceUntil } = await getPlanUsage(ws);
  const block = blocked ? BLOCK_MESSAGES[blocked] : null;

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
      <GraceAlert until={graceUntil} />
      {block ? (
        <EmptyState
          icon={CreditCard}
          title={block.title}
          description={block.text}
          action={
            <Button variant="brand" asChild>
              <Link href="/piano">{block.cta}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Link
            href={defaultScriptId ? `/video/registra?script=${defaultScriptId}` : "/video/registra"}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm transition-colors hover:border-nx-blue-500/50"
          >
            <Video className="size-5 shrink-0 text-primary-text" aria-hidden />
            <span className="flex-1">
              <span className="block font-medium">Registra adesso con il teleprompter</span>
              <span className="block text-muted-foreground">
                Fotocamera frontale e testo dello script a schermo.
              </span>
            </span>
          </Link>
          <Uploader
            workspaceId={ws.id}
            scripts={scripts.map((s) => ({ id: s.id, title: s.title }))}
            defaultScriptId={defaultScriptId}
          />
        </>
      )}
    </PageContainer>
  );
}
