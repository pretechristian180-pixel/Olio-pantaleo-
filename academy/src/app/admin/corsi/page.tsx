import { GraduationCap } from "lucide-react";
import { getPublishedCourses } from "@/lib/data/courses";
import { formatDuration, formatPrice, pluralize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

// Fase 1: elenco in sola lettura (corsi pubblicati). Bozze, editor e riordino arrivano in Fase 4.
export default async function AdminCoursesPage() {
  const courses = await getPublishedCourses();
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader eyebrow="Contenuti" title="Corsi" />
      {courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Nessun corso"
          description="Il primo corso che crei compare qui."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-alt text-ink-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Corso
                </th>
                <th scope="col" className="hidden px-5 py-3 font-semibold sm:table-cell">
                  Contenuti
                </th>
                <th scope="col" className="hidden px-5 py-3 font-semibold md:table-cell">
                  Prezzo
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Stato
                </th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-4 font-semibold">{c.titolo}</td>
                  <td className="hidden px-5 py-4 text-ink-muted sm:table-cell">
                    {pluralize(c.outline.moduli.length, "modulo", "moduli")} ·{" "}
                    {pluralize(c.outline.totaleLezioni, "lezione", "lezioni")} ·{" "}
                    {formatDuration(c.outline.totaleDurataSec)}
                  </td>
                  <td className="hidden px-5 py-4 md:table-cell">
                    {formatPrice(c.prezzo_cents, c.valuta)}
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone="positive">Pubblicato</Badge>
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
