import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { AnswerForm } from "@/components/admin/panel/answer-form";
import { getQuestions } from "@/lib/data/admin-panel";
import { formatDate } from "@/lib/format-date";
import { setQuestionStatus } from "@/app/admin/panel-actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Domande" };

const STATI = {
  aperta: { label: "Da rispondere", tone: "solid" },
  risposta: { label: "Risposta", tone: "positive" },
  chiusa: { label: "Chiusa", tone: "neutral" },
} as const;

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const tutte = (await searchParams).vista === "tutte";
  const questions = await getQuestions(!tutte);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Domande"
        description="Le domande degli studenti sotto le lezioni. Ogni risposta la vedono tutti gli iscritti al corso."
      />
      <nav aria-label="Filtro domande" className="flex gap-2">
        <Tab href="/admin/domande" active={!tutte}>
          Da rispondere
        </Tab>
        <Tab href="/admin/domande?vista=tutte" active={tutte}>
          Tutte
        </Tab>
      </nav>
      {questions.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title={tutte ? "Ancora nessuna domanda" : "Nessuna domanda da rispondere"}
          description="Quando uno studente fa una domanda la trovi qui, in ordine di arrivo."
        />
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <Card key={q.id}>
              <CardBody className="space-y-4 sm:p-7">
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <Badge tone={STATI[q.stato].tone}>{STATI[q.stato].label}</Badge>
                  <span>
                    {q.autore || "Studente"} · {formatDate(q.creato_il)} · {q.corso} ›{" "}
                    <Link
                      href={`/app/corsi/${q.corso_slug}/${q.lezione_slug}`}
                      className="font-semibold text-nexora-blue-bright hover:underline"
                    >
                      {q.lezione}
                    </Link>
                  </span>
                </div>
                <p className="whitespace-pre-line">{q.testo}</p>
                {q.answers.length > 0 && (
                  <ul className="space-y-3 border-l-2 border-line pl-4">
                    {q.answers.map((a) => (
                      <li key={a.id} className="text-sm">
                        <p className="font-semibold">
                          {a.is_docente ? "Risposta del docente" : "Risposta di uno studente"}{" "}
                          <span className="font-normal text-ink-muted">
                            · {formatDate(a.creato_il)}
                          </span>
                        </p>
                        <p className="mt-1 whitespace-pre-line">{a.testo}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {q.stato !== "chiusa" && <AnswerForm questionId={q.id} />}
                <form
                  action={setQuestionStatus.bind(
                    null,
                    q.id,
                    q.stato === "chiusa" ? "aperta" : "chiusa",
                  )}
                >
                  <SubmitButton variant="ghost" pendingText="Un attimo…">
                    {q.stato === "chiusa" ? "Riapri" : "Chiudi senza rispondere"}
                  </SubmitButton>
                </form>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center rounded-md px-4 text-sm font-semibold",
        active
          ? "bg-graphite-deep text-white"
          : "border border-line bg-surface hover:border-ink-muted",
      )}
    >
      {children}
    </Link>
  );
}
