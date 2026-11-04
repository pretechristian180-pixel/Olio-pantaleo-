"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerQuestion, askQuestion } from "@/app/app/actions";
import type { ThreadRow } from "@/lib/data/student";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
function quando(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function QuestionsPanel({
  lessonId,
  thread,
  canAsk,
}: {
  lessonId: string;
  thread: ThreadRow[];
  canAsk: boolean;
}) {
  const domande = thread.filter((t) => t.tipo === "domanda").reverse();
  const risposte = (id: string) =>
    thread.filter((t) => t.tipo === "risposta" && t.question_id === id);

  if (!canAsk) {
    return (
      <p className="text-[15px] text-ink-muted">
        Le domande al docente sono riservate a chi è iscritto al corso.
      </p>
    );
  }

  return (
    <div className="flex max-w-190 flex-col gap-6">
      <Composer
        id="nuova-domanda"
        label="Fai una domanda sulla lezione"
        placeholder="Cosa non ti è chiaro? Più sei concreto, più la risposta ti sarà utile."
        submitLabel="Invia la domanda"
        onSubmit={(testo) => askQuestion({ lessonId, testo })}
      />
      {domande.length === 0 ? (
        <p className="text-sm text-ink-muted">Nessuna domanda ancora. Sii il primo.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {domande.map((q) => (
            <li key={q.id} className="flex flex-col gap-3">
              <Message row={q} />
              {risposte(q.id).map((r) => (
                <div key={r.id} className="ml-4 sm:ml-8">
                  <Message row={r} />
                </div>
              ))}
              <div className="ml-4 sm:ml-8">
                <ReplyToggle questionId={q.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Message({ row }: { row: ThreadRow }) {
  return (
    <article className={cn("rounded-lg p-4", row.is_docente ? "bg-blue-tint" : "bg-surface-alt")}>
      <p className={cn("text-[15px] font-bold", row.is_docente && "text-nexora-blue-deep")}>
        {row.autore} · {row.is_docente ? "Risposta" : quando(row.creato_il)}
        {row.is_mio && !row.is_docente && <span className="font-normal text-ink-muted"> (tu)</span>}
      </p>
      <p className="mt-1.5 text-[15px] leading-6 whitespace-pre-line">{row.testo}</p>
    </article>
  );
}

function ReplyToggle({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 text-sm font-semibold text-nexora-blue hover:underline"
      >
        Rispondi
      </button>
    );
  }
  return (
    <Composer
      id={`risposta-${questionId}`}
      label="La tua risposta"
      submitLabel="Invia la risposta"
      onSubmit={(testo) => answerQuestion({ questionId, testo })}
      onDone={() => setOpen(false)}
      autoFocus
    />
  );
}

function Composer({
  id,
  label,
  placeholder,
  submitLabel,
  onSubmit,
  onDone,
  autoFocus,
}: {
  id: string;
  label: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (testo: string) => Promise<{ ok: boolean; error?: string }>;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [testo, setTesto] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await onSubmit(testo);
          if (!res.ok) return setError(res.error);
          setTesto("");
          setError(undefined);
          onDone?.();
          router.refresh();
        });
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <Textarea
        id={id}
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="min-h-24"
      />
      {error && <Alert>{error}</Alert>}
      <div>
        <Button type="submit" disabled={pending || testo.trim().length < 2}>
          {pending ? "Invio…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
