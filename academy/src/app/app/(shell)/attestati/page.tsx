import type { Metadata } from "next";
import Link from "next/link";
import { Award, Download, Link2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { claimCertificate } from "@/lib/certificates";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format-date";

export const metadata: Metadata = { title: "Attestati" };

export default async function CertificatesPage() {
  const user = await requireUser("/app/attestati");
  const supabase = await createClient();
  // Corsi completati senza attestato (es. finiti prima che il nome fosse inserito): li rilasciamo ora.
  const { data: iscrizioni } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("user_id", user.id);
  const esiti = await Promise.all((iscrizioni ?? []).map((e) => claimCertificate(e.course_id)));
  const manca_nome = esiti.some((e) => e.stato === "nome_mancante");

  const { data } = await supabase
    .from("certificates")
    .select("codice, nome_intestatario, rilasciato_il, courses(titolo)")
    .eq("user_id", user.id)
    .order("rilasciato_il", { ascending: false });
  const certs = (data ?? []).map((c) => ({
    ...c,
    corso: (c.courses as unknown as { titolo: string } | null)?.titolo ?? "Corso",
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Attestati"
        description="Completa tutte le lezioni di un corso e qui trovi il tuo attestato, con il codice per verificarlo."
      />
      {manca_nome && (
        <Alert>
          Hai completato un corso: per rilasciare l&apos;attestato ci serve il tuo nome e cognome.{" "}
          <Link href="/app/profilo" className="font-semibold underline">
            Aggiungili nel profilo
          </Link>
          , poi torna qui.
        </Alert>
      )}
      {certs.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Nessun attestato"
          description="Completa un corso al 100% e trovi qui il tuo attestato, con il codice per verificarlo."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {certs.map((c) => (
            <Card key={c.codice}>
              <CardBody className="space-y-4">
                <Award aria-hidden className="size-8 text-nexora-blue-bright" />
                <div>
                  <CardTitle>{c.corso}</CardTitle>
                  <p className="mt-1 text-sm text-ink-muted">
                    {c.nome_intestatario} · {formatDate(c.rilasciato_il)}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{c.codice}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={`/attestati/${c.codice}/pdf`} target="_blank" rel="noreferrer">
                      <Download aria-hidden /> Scarica PDF
                    </a>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href={`/attestati/${c.codice}`}>
                      <Link2 aria-hidden /> Pagina di verifica
                    </Link>
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
