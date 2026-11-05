import Link from "next/link";
import { AlertTriangle, FileText, Loader2, RotateCcw } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { retryWeekGeneration } from "@/lib/actions/scripts";
import type { GenerationState } from "@/lib/scripts";

import { AutoRefresh } from "./auto-refresh";

/** Cosa mostrare quando una settimana non ha (ancora) script. */
export function WeekStatus({
  state,
  workspaceId,
  weekStart,
  isOwner,
  block,
}: {
  state: GenerationState;
  workspaceId: string;
  weekStart: string;
  isOwner: boolean;
  /** Script sospesi (prova finita, pagamento fallito, abbonamento non attivo). */
  block?: { title: string; text: string; cta: string } | null;
}) {
  if (state === "queued" || state === "running") {
    return (
      <div
        role="status"
        className="relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border bg-card px-6 py-12 text-center"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-aurora opacity-0 dark:opacity-100"
          aria-hidden
        />
        <span className="relative flex size-12 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </span>
        <div className="relative grid max-w-sm gap-1.5">
          <p className="font-display text-lg font-semibold">Stiamo scrivendo i tuoi script</p>
          <p className="text-sm text-muted-foreground">
            Ci vuole circa un minuto. Puoi restare qui o tornare più tardi: ti mandiamo anche
            un&apos;email.
          </p>
        </div>
        <AutoRefresh seconds={5} />
      </div>
    );
  }
  if (state === "failed") {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertTitle>Non siamo riusciti a preparare gli script</AlertTitle>
        <AlertDescription className="grid gap-3">
          <p>Il nostro team è stato avvisato.{isOwner ? " Puoi anche riprovare adesso." : ""}</p>
          {isOwner && (
            <form action={retryWeekGeneration}>
              <input type="hidden" name="workspace_id" value={workspaceId} />
              <input type="hidden" name="week_start" value={weekStart} />
              <Button type="submit" variant="outline" size="sm">
                <RotateCcw aria-hidden /> Riprova
              </Button>
            </form>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  if (block) {
    return (
      <EmptyState
        icon={FileText}
        title={block.title}
        description={block.text}
        action={
          <Button variant="brand" asChild>
            <Link href="/piano">{block.cta}</Link>
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={FileText}
      title="Gli script arrivano domenica sera"
      description="Ogni settimana prepariamo gli script in base al tuo brand. Il lunedì mattina ti mandiamo un'email."
      action={
        <Button variant="outline" asChild>
          <Link href="/brand">Rivedi il brand</Link>
        </Button>
      }
    />
  );
}
