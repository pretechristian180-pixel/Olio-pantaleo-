import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { ScriptCard } from "@/components/scripts/script-card";
import { WeekStatus } from "@/components/scripts/week-status";
import {
  defaultWeek,
  getBatchScripts,
  getGenerationState,
  listBatches,
  MAX_REGENERATIONS,
  shortWeekLabel,
  weekLabel,
} from "@/lib/scripts";
import { cn } from "@/lib/utils";
import { BLOCK_MESSAGES, getPlanUsage } from "@/lib/billing";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Script" };

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ScriptPage(props: PageProps<"/script">) {
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;
  const { blocked } = await getPlanUsage(ws);
  const scriptBlock = blocked && blocked !== "limit_reached" ? BLOCK_MESSAGES[blocked] : null;
  const { settimana } = await props.searchParams;

  const batches = await listBatches(ws.id);
  const week =
    typeof settimana === "string" && WEEK_RE.test(settimana) ? settimana : await defaultWeek(ws.id);
  const batch = batches.find((b) => b.week_start === week) ?? null;
  const scripts = batch ? await getBatchScripts(batch.id) : [];
  const state = scripts.length ? "done" : await getGenerationState(ws.id, week);

  const toShoot = scripts.filter((s) => s.status === "to_shoot").length;
  const regenLeft = batch ? MAX_REGENERATIONS - batch.regenerations_used : MAX_REGENERATIONS;

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Script" description={`Settimana ${weekLabel(week)}`} />

      {batches.length > 1 && (
        <nav aria-label="Settimane" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2">
            {batches.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/script?settimana=${b.week_start}`}
                  aria-current={b.week_start === week ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border bg-card px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground",
                    b.week_start === week && "border-nx-blue-500 bg-accent text-accent-foreground",
                  )}
                >
                  {shortWeekLabel(b.week_start)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {scripts.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">{toShoot}</span> da girare su{" "}
              {scripts.length}
            </p>
            <p className="flex items-center gap-1.5">
              <RefreshCw className="size-3.5" aria-hidden />
              {regenLeft > 0
                ? `Puoi riscrivere ancora ${regenLeft} script questa settimana`
                : "Riscritture della settimana esaurite"}
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {scripts.map((s, i) => (
              <li key={s.id}>
                <ScriptCard script={s} index={i} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <WeekStatus
          state={state}
          workspaceId={ws.id}
          weekStart={week}
          isOwner={ctx.active.role === "owner"}
          block={scriptBlock}
        />
      )}
    </PageContainer>
  );
}
