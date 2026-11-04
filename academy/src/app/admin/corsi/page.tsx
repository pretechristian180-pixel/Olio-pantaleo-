import { GraduationCap, Plus } from "lucide-react";
import { getPublishedCourses } from "@/lib/data/courses";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { AdminStats } from "@/components/admin/admin-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const th = "px-5 py-4 text-[11px] font-semibold tracking-[0.16em] text-ink-muted uppercase";

// Fase 1: elenco in sola lettura dei corsi pubblicati.
// Bozze, editor, riordino e upload video (pannello "Nuova lezione" del mockup) arrivano in Fase 4.
export default async function AdminCoursesPage() {
  const courses = await getPublishedCourses();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Gestione"
        title="I tuoi corsi"
        actions={
          <Button size="lg" disabled title="Disponibile in Fase 4">
            <Plus aria-hidden /> Nuovo corso
          </Button>
        }
      />
      <AdminStats
        n={{
          venditeMeseCents: null,
          studentiAttivi: null,
          completamentoMedio: null,
          lezioneAbbandoni: null,
        }}
      />
      {courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Nessun corso"
          description="Il primo corso che crei compare qui."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-150 text-left text-sm">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={th}>
                  Corso
                </th>
                <th scope="col" className={th}>
                  Stato
                </th>
                <th scope="col" className={th}>
                  Lezioni
                </th>
                <th scope="col" className={th}>
                  Prezzo
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3.5">
                      {c.copertinaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.copertinaUrl}
                          alt=""
                          className="h-10 w-16 rounded-sm object-cover"
                        />
                      ) : (
                        <span aria-hidden className="h-10 w-16 shrink-0 rounded-sm bg-graphite" />
                      )}
                      <span className="font-semibold">{c.titolo}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone="positive">Pubblicato</Badge>
                  </td>
                  <td className="px-5 py-4 text-ink-muted">{c.outline.totaleLezioni}</td>
                  <td className="px-5 py-4 text-ink-muted">
                    {formatPrice(c.prezzo_cents, c.valuta)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className="text-sm font-semibold text-ink-muted"
                      title="Disponibile in Fase 4"
                    >
                      Modifica
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
