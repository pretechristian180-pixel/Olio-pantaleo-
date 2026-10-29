import { Link } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskWithRefs } from "@/services/api";

/** Lista con spunta: le cose da fare non ancora fatte stanno in alto. */
export function TaskList({
  tasks,
  onToggle,
}: {
  tasks: TaskWithRefs[];
  onToggle: (id: string, text: string, wasDone: boolean) => void;
}) {
  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done));
  const allDone = tasks.every((t) => t.done);

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-card">
      {allDone && (
        <div className="flex items-center gap-3 border-b bg-success-soft px-4 py-3 font-medium text-success">
          <Check className="size-5" aria-hidden />
          Hai fatto tutto. Ottimo lavoro!
        </div>
      )}
      <ul className="divide-y">
        {sorted.map((t) => (
          <li key={t.id} className="flex items-stretch">
            <button
              type="button"
              role="checkbox"
              aria-checked={t.done}
              onClick={() => onToggle(t.id, t.text, t.done)}
              className="flex flex-1 items-start gap-4 p-4 text-left transition-colors hover:bg-muted/50"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  t.done ? "border-success bg-success text-white" : "border-input",
                )}
              >
                {t.done && <Check className="size-4" strokeWidth={3} aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-[17px] font-semibold leading-snug", t.done && "text-muted-foreground line-through")}>
                  {t.text}
                </span>
                {t.detail && (
                  <span className={cn("mt-0.5 block text-muted-foreground", t.done && "line-through opacity-70")}>{t.detail}</span>
                )}
              </span>
            </button>
            {t.contact && !t.done && (
              <Link
                to={`/contatti/${t.contact.id}`}
                className="flex shrink-0 items-center gap-0.5 px-4 text-[15px] font-medium text-primary-strong hover:bg-primary-soft/50"
              >
                Apri
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
