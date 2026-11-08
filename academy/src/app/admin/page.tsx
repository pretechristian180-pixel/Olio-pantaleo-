import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AdminStats } from "@/components/admin/admin-stats";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOrders, getOverview, getQuestions } from "@/lib/data/admin-panel";
import { formatPrice } from "@/lib/utils";

export default async function AdminOverviewPage() {
  const [n, orders, questions] = await Promise.all([
    getOverview(),
    getOrders(5),
    getQuestions(true),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Panoramica" title="Come va l'Academy" />
      <AdminStats n={n} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Ultime vendite</CardTitle>
              <MoreLink href="/admin/vendite" />
            </div>
            {orders.length ? (
              <ul className="divide-y divide-line">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {o.corso ?? "Corso eliminato"}
                      </span>
                      <span className="block truncate text-ink-muted">{o.email}</span>
                    </span>
                    <span className="shrink-0 font-semibold">
                      {formatPrice(o.importo_cents, o.valuta)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Ancora nessuna vendita.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>
                Domande da rispondere{" "}
                {n.domande_aperte > 0 && <Badge tone="solid">{n.domande_aperte}</Badge>}
              </CardTitle>
              <MoreLink href="/admin/domande" />
            </div>
            {questions.length ? (
              <ul className="divide-y divide-line">
                {questions.slice(0, 5).map((q) => (
                  <li key={q.id} className="py-3 text-sm">
                    <p className="line-clamp-2">{q.testo}</p>
                    <p className="mt-1 text-ink-muted">
                      {q.autore || "Studente"} · {q.lezione}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Nessuna domanda in attesa.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function MoreLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-nexora-blue-bright hover:underline"
    >
      Vedi tutto <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}
