import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SubmitButton } from "@/components/ui/submit-button";
import { getStudentCourses, getStudents } from "@/lib/data/admin-panel";
import { formatDate } from "@/lib/format-date";
import { revokeAccess } from "@/app/admin/panel-actions";

export const metadata: Metadata = { title: "Studente" };

const FONTI = {
  stripe: "Acquisto",
  manuale: "Accesso manuale",
  azienda: "Azienda",
  abbonamento: "Abbonamento",
} as const;

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const student = (await getStudents()).find((s) => s.user_id === id);
  if (!student) notFound();
  const courses = await getStudentCourses(id);
  const nome = [student.nome, student.cognome].filter(Boolean).join(" ") || student.email;
  return (
    <div className="space-y-8">
      <Link
        href="/admin/studenti"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Tutti gli studenti
      </Link>
      <PageHeader title={nome} description={student.email} />
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-3 sm:p-8">
          <Info label="Iscritto all'academy" value={formatDate(student.iscritto_il)} />
          <Info
            label="Ultima attività"
            value={student.ultima_attivita ? formatDate(student.ultima_attivita) : "Mai"}
          />
          <Info label="Email promozionali" value={student.consenso_marketing ? "Sì" : "No"} />
        </CardBody>
      </Card>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Corsi</h2>
        {courses.length === 0 && <p className="text-ink-muted">Nessun corso attivo.</p>}
        {courses.map((c) => {
          const perc = c.lezioni ? Math.round((100 * c.completate) / c.lezioni) : 0;
          return (
            <Card key={c.course_id}>
              <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{c.titolo}</CardTitle>
                    <Badge tone="neutral">{FONTI[c.fonte]}</Badge>
                  </div>
                  <p className="text-sm text-ink-muted">
                    Dal {formatDate(c.iscritto_il)} · {c.completate} di {c.lezioni} lezioni
                    completate
                  </p>
                  <ProgressBar value={perc} label={`Avanzamento ${perc}%`} />
                </div>
                <form action={revokeAccess.bind(null, id, c.course_id)}>
                  <SubmitButton variant="secondary" pendingText="Rimuovo…">
                    Togli accesso
                  </SubmitButton>
                </form>
              </CardBody>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
