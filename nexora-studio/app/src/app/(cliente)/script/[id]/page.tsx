import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Clock,
  Lightbulb,
  MapPin,
  RotateCcw,
  SkipForward,
  Sun,
  Upload,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-header";
import { RegeneratePanel } from "@/components/scripts/regenerate-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setScriptStatus } from "@/lib/actions/scripts";
import {
  FORMAT_LABELS,
  MAX_REGENERATIONS,
  STATUS_LABELS,
  type Script,
  weekLabel,
} from "@/lib/scripts";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Script" };

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function ScriptDetailPage(props: PageProps<"/script/[id]">) {
  const { id } = await props.params;
  const ctx = await requireWorkspace();
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("scripts").select("*").eq("id", id).maybeSingle();
  const script = data as Script | null;
  // RLS: script di altre aziende non sono visibili. Mostriamo solo quelli dell'azienda attiva.
  if (!script || script.workspace_id !== ctx.active.workspace.id) notFound();

  const { data: batch } = await supabase
    .from("script_batches")
    .select("week_start, regenerations_used")
    .eq("id", script.batch_id)
    .single();

  const notes = script.shooting_notes ?? {};
  const lines = script.body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const skipped = script.status === "skipped";

  return (
    <PageContainer className="max-w-3xl">
      <Link
        href={batch ? `/script?settimana=${batch.week_start}` : "/script"}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Script{" "}
        {batch ? `della settimana ${weekLabel(batch.week_start)}` : ""}
      </Link>

      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{FORMAT_LABELS[script.format]}</Badge>
          <Badge
            variant={skipped ? "secondary" : script.status === "uploaded" ? "success" : "warning"}
          >
            {STATUS_LABELS[script.status]}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold text-balance sm:text-3xl">{script.title}</h1>
      </header>

      <section
        aria-labelledby="hook-title"
        className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-6"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-aurora opacity-0 dark:opacity-100"
          aria-hidden
        />
        <p
          id="hook-title"
          className="relative text-xs font-semibold tracking-[0.14em] text-primary-text uppercase"
        >
          Le prime parole (3 secondi)
        </p>
        <p className="relative mt-2 font-display text-xl leading-snug font-semibold text-balance sm:text-2xl">
          «{script.hook}»
        </p>
      </section>

      <section aria-labelledby="body-title" className="grid gap-3">
        <h2 id="body-title" className="text-lg font-semibold">
          Cosa dire
        </h2>
        <div className="grid gap-2.5 rounded-xl border bg-card p-5 text-base leading-relaxed sm:text-lg">
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
          {script.call_to_action && (
            <p className="mt-2 border-t pt-3 font-medium text-primary-text">
              {script.call_to_action}
            </p>
          )}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Come girarlo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: MapPin, label: "Dove", value: notes.location },
              { icon: Camera, label: "Inquadratura", value: notes.framing },
              { icon: Sun, label: "Luce", value: notes.light },
              {
                icon: Clock,
                label: "Durata",
                value: notes.duration_seconds
                  ? `Circa ${notes.duration_seconds} secondi`
                  : undefined,
              },
            ]
              .filter((n) => n.value)
              .map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary-text">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="grid gap-0.5">
                    <dt className="text-xs font-semibold text-muted-foreground uppercase">
                      {label}
                    </dt>
                    <dd className="text-sm">{value}</dd>
                  </div>
                </div>
              ))}
          </dl>
          {notes.tips && notes.tips.length > 0 && (
            <div className="grid gap-2 rounded-lg bg-muted/60 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="size-4 text-warning" aria-hidden /> Consigli
              </p>
              <ul className="grid list-disc gap-1 pl-5 text-sm">
                {notes.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <section aria-label="Azioni" className="grid gap-3">
        {!skipped && (
          <Button variant="brand" size="lg" asChild>
            <Link href={`/video/carica?script=${script.id}`}>
              <Upload aria-hidden /> Carica il girato
            </Link>
          </Button>
        )}
        {script.status !== "uploaded" && (
          <form action={setScriptStatus} className="grid">
            <input type="hidden" name="script_id" value={script.id} />
            <input type="hidden" name="status" value={skipped ? "to_shoot" : "skipped"} />
            <Button type="submit" variant={skipped ? "default" : "ghost"} size="lg">
              {skipped ? <RotateCcw aria-hidden /> : <SkipForward aria-hidden />}
              {skipped ? "Rimetti tra i video da girare" : "Salta questo video"}
            </Button>
          </form>
        )}
        {script.status !== "uploaded" && (
          <RegeneratePanel
            scriptId={script.id}
            remaining={MAX_REGENERATIONS - (batch?.regenerations_used ?? 0)}
          />
        )}
      </section>
    </PageContainer>
  );
}
