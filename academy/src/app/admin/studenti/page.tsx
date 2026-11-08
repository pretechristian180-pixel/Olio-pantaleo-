import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GrantAccessForm } from "@/components/admin/panel/grant-access-form";
import { getCourseOptions, getStudents } from "@/lib/data/admin-panel";
import { formatDate } from "@/lib/format-date";

export const metadata: Metadata = { title: "Studenti" };

const RUOLI = { student: "Studente", instructor: "Docente", admin: "Admin" } as const;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [students, courses] = await Promise.all([getStudents(q), getCourseOptions()]);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Studenti"
        description="Chi è iscritto alla tua academy, a quali corsi e a che punto è."
      />
      <Card>
        <CardBody className="space-y-4 sm:p-8">
          <CardTitle>Dai accesso a un corso</CardTitle>
          <p className="text-sm text-ink-muted">
            Per chi ha pagato con bonifico, per un omaggio o per un cliente aziendale. La persona
            deve avere già un account.
          </p>
          <GrantAccessForm courses={courses} />
        </CardBody>
      </Card>

      <form role="search" className="flex gap-2" action="/admin/studenti">
        <label htmlFor="cerca" className="sr-only">
          Cerca per nome o email
        </label>
        <Input id="cerca" name="q" defaultValue={q} placeholder="Cerca per nome o email" />
        <Button type="submit" variant="secondary" size="lg" aria-label="Cerca">
          <Search aria-hidden />
        </Button>
      </form>

      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "Nessun risultato" : "Ancora nessuno studente"}
          description={
            q
              ? "Prova con un'altra parte del nome o dell'email."
              : "Chi si registra o compra un corso compare qui."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-170 text-left text-sm">
            <thead className="border-b border-line text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Persona</th>
                <th className="px-4 py-3 font-medium">Corsi</th>
                <th className="px-4 py-3 font-medium">Completamento</th>
                <th className="px-4 py-3 font-medium">Ultima attività</th>
                <th className="px-4 py-3 font-medium">Iscritto il</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => (
                <tr key={s.user_id} className="hover:bg-surface-alt">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/studenti/${s.user_id}`}
                      className="font-semibold hover:text-nexora-blue-bright"
                    >
                      {[s.nome, s.cognome].filter(Boolean).join(" ") || s.email}
                    </Link>
                    <span className="block text-ink-muted">{s.email}</span>
                    {s.ruolo !== "student" && (
                      <Badge tone="neutral" className="mt-1">
                        {RUOLI[s.ruolo]}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">{s.corsi}</td>
                  <td className="px-4 py-3">
                    {s.completamento === null ? "—" : `${s.completamento}%`}
                  </td>
                  <td className="px-4 py-3">
                    {s.ultima_attivita ? formatDate(s.ultima_attivita) : "—"}
                  </td>
                  <td className="px-4 py-3">{formatDate(s.iscritto_il)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
