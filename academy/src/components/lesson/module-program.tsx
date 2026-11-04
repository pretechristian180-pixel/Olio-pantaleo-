import Link from "next/link";
import { Check, Lock, Play } from "lucide-react";
import type { OutlineModule } from "@/lib/course-outline";
import { cn, formatTimestamp } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { ProgressMap } from "@/lib/data/student";

/** Programma del modulo con lo stato di ogni lezione (colonna destra del mockup Lezione). */
export function ModuleProgram({
  courseSlug,
  modulo,
  moduloSuccessivo,
  currentId,
  progress,
  enrolled,
}: {
  courseSlug: string;
  modulo: OutlineModule;
  moduloSuccessivo: OutlineModule | null;
  currentId: string;
  progress: ProgressMap;
  enrolled: boolean;
}) {
  const fatte = modulo.lezioni.filter((l) => progress.get(l.id)?.completata).length;
  return (
    <div className="flex flex-col gap-5">
      <div className="hidden lg:block">
        <h2 className="text-lg leading-snug font-semibold">
          Modulo {modulo.numero} · {modulo.titolo}
        </h2>
        <p className="mt-2 text-[13px] text-ink-muted">
          {fatte} di {modulo.lezioni.length} lezioni completate
        </p>
      </div>
      <ol className="flex flex-col gap-1">
        {modulo.lezioni.map((l) => {
          const current = l.id === currentId;
          const done = progress.get(l.id)?.completata;
          const locked = !enrolled && !l.isFreePreview;
          return (
            <li key={l.id}>
              <Link
                href={`/app/corsi/${courseSlug}/${l.slug}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-13 items-center gap-3 rounded-md px-2.5 py-2 text-sm",
                  current ? "bg-blue-tint font-bold" : "hover:bg-surface-alt",
                )}
              >
                <StatusIcon done={!!done} current={current} locked={locked} />
                <span className="flex-1 leading-snug">{l.titolo}</span>
                <span className="text-xs text-ink-muted tabular-nums">
                  {formatTimestamp(l.durataSec)}
                </span>
                <span className="sr-only">
                  {done
                    ? ", completata"
                    : current
                      ? ", in corso"
                      : locked
                        ? ", inclusa nel corso completo"
                        : ", da fare"}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {moduloSuccessivo && (
        <div className="rounded-lg border border-line bg-surface p-4">
          <Eyebrow tone="muted" className="text-[11px]">
            Prossimo modulo
          </Eyebrow>
          <p className="mt-2 text-sm font-semibold">
            {moduloSuccessivo.numero} · {moduloSuccessivo.titolo}
          </p>
        </div>
      )}
    </div>
  );
}

function StatusIcon({
  done,
  current,
  locked,
}: {
  done: boolean;
  current: boolean;
  locked: boolean;
}) {
  if (done)
    return (
      <span
        aria-hidden
        className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-positive text-white"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  if (current)
    return (
      <span
        aria-hidden
        className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-nexora-blue text-white"
      >
        <Play className="size-3 fill-current" />
      </span>
    );
  if (locked)
    return (
      <span
        aria-hidden
        className="flex size-6.5 shrink-0 items-center justify-center rounded-full border-2 border-line text-ink-muted"
      >
        <Lock className="size-3" />
      </span>
    );
  return <span aria-hidden className="size-6.5 shrink-0 rounded-full border-2 border-line" />;
}
