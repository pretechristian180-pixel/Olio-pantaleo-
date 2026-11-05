import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { localParts, type SocialPlatform } from "@nexora/shared";

import { CalendarBoard } from "@/components/calendar/calendar-board";
import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { scheduleVideoAction } from "@/lib/actions/calendar";
import { getCalendar, getUnscheduled } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Calendario" };

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const isoDow = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
const dayLabel = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthLabel = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function CalendarioPage(props: PageProps<"/calendario">) {
  const ctx = await requireWorkspace();
  const ws = ctx.active.workspace;
  const tz = ws.timezone;
  const sp = await props.searchParams;
  const view = sp.vista === "mese" ? "mese" : "settimana";
  const today = localParts(new Date(), tz).date;
  const anchor = typeof sp.da === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.da) ? sp.da : today;

  let days: { date: string; label: string; outside?: boolean }[];
  let prev: string;
  let next: string;
  let title: string;
  if (view === "settimana") {
    const monday = addDays(anchor, -(isoDow(anchor) - 1));
    days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return { date, label: dayLabel.format(new Date(`${date}T12:00:00Z`)) };
    });
    prev = addDays(monday, -7);
    next = addDays(monday, 7);
    title = `Settimana dal ${dayLabel.format(new Date(`${monday}T12:00:00Z`))}`;
  } else {
    const first = `${anchor.slice(0, 7)}-01`;
    const gridStart = addDays(first, -(isoDow(first) - 1));
    days = Array.from({ length: 42 }, (_, i) => {
      const date = addDays(gridStart, i);
      return {
        date,
        label: String(Number(date.slice(8))),
        outside: date.slice(0, 7) !== first.slice(0, 7),
      };
    });
    const m = new Date(`${first}T12:00:00Z`);
    prev = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - 1, 1))
      .toISOString()
      .slice(0, 10);
    next = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))
      .toISOString()
      .slice(0, 10);
    title = monthLabel.format(m);
  }

  const from = new Date(`${days[0]!.date}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(`${days[days.length - 1]!.date}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 2);

  const supabase = await createClient();
  const [items, unscheduled, { data: accounts }] = await Promise.all([
    getCalendar(ws.id, from, to, tz),
    getUnscheduled(ws.id),
    supabase.from("social_accounts").select("platform, status, enabled").eq("workspace_id", ws.id),
  ]);
  const connected = (accounts ?? [])
    .filter((a) => a.status === "connected" && a.enabled)
    .map((a) => a.platform as SocialPlatform);
  const href = (params: Record<string, string>) =>
    `/calendario?${new URLSearchParams({ vista: view, da: anchor, ...params })}`;

  return (
    <PageContainer>
      <PageHeader
        title="Calendario"
        description="Quando escono i tuoi post. Puoi spostarli quando vuoi, fino a poco prima dell'uscita."
        actions={
          <div
            className="inline-flex rounded-lg border bg-muted/50 p-1"
            role="group"
            aria-label="Vista"
          >
            {(["settimana", "mese"] as const).map((v) => (
              <Link
                key={v}
                href={href({ vista: v })}
                aria-current={v === view ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground",
                  v === view && "bg-card text-foreground shadow-sm",
                )}
              >
                {v === "settimana" ? "Settimana" : "Mese"}
              </Link>
            ))}
          </div>
        }
      />

      {connected.length === 0 && (
        <EmptyState
          icon={Share2}
          title="Collega i tuoi social"
          description="Per programmare i video approvati serve almeno un social collegato."
          action={
            <Button variant="brand" asChild>
              <Link href="/social">Collega i social</Link>
            </Button>
          }
        />
      )}

      {unscheduled.length > 0 && connected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approvati, da programmare</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {unscheduled.map((u) => (
                <li
                  key={u.videoId}
                  className="flex items-center gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{u.title}</span>
                  <form action={scheduleVideoAction}>
                    <input type="hidden" name="video_id" value={u.videoId} />
                    <Button size="sm" variant="outline" type="submit">
                      Programma
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={href({ da: prev })} aria-label="Periodo precedente">
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h2 className="text-center text-base font-semibold capitalize">{title}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={href({ da: today })}>Oggi</Link>
          </Button>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={href({ da: next })} aria-label="Periodo successivo">
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <CalendarBoard
        view={view}
        days={days}
        today={today}
        items={items}
        platforms={connected}
        defaultTime={ws.posting_time.slice(0, 5)}
      />
      {items.length === 0 && connected.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden /> Nessun post in questo periodo. I video
          approvati entrano qui da soli.
        </p>
      )}
    </PageContainer>
  );
}
