import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getAdminCourses } from "@/lib/data/admin";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { NewCourseButton } from "@/components/admin/course/new-course-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const th = "px-5 py-4 text-[11px] font-semibold tracking-[0.16em] text-ink-muted uppercase";

export default async function AdminCoursesPage() {
  await requireStaff();
  const courses = await getAdminCourses();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Gestione" title="I tuoi corsi" actions={<NewCourseButton />} />
      {courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Crea il tuo primo corso"
          description="Dagli un titolo: poi aggiungi moduli e lezioni, carichi i video e lo pubblichi quando è pronto."
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
                          className="h-10 w-16 shrink-0 rounded-sm object-cover"
                        />
                      ) : (
                        <span aria-hidden className="h-10 w-16 shrink-0 rounded-sm bg-graphite" />
                      )}
                      <span className="font-semibold">{c.titolo}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {c.stato === "published" ? (
                      <Badge tone="positive">Pubblicato</Badge>
                    ) : (
                      <Badge tone="neutral">Bozza</Badge>
                    )}
                  </td>
                  <td className="px-5 py-4 text-ink-muted">{c.lezioni}</td>
                  <td className="px-5 py-4 text-ink-muted">
                    {c.prezzo_cents ? formatPrice(c.prezzo_cents, c.valuta) : "Gratis"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/corsi/${c.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-bold text-nexora-blue-bright hover:text-nexora-blue-bright"
                    >
                      Modifica<span className="sr-only"> {c.titolo}</span>
                    </Link>
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
