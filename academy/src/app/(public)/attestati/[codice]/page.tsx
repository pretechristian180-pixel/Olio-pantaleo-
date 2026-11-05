import type { Metadata } from "next";
import { BadgeCheck, CircleX, Download } from "lucide-react";
import { getCertificate } from "@/lib/data/certificates";
import { formatHours } from "@/lib/certificate-pdf";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ codice: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cert = await getCertificate((await params).codice);
  return {
    title: cert ? `Attestato di ${cert.nome_intestatario}` : "Attestato non trovato",
    description: cert ? `${cert.corso} · ${cert.academy}` : undefined,
    robots: { index: false },
  };
}

/** Verifica pubblica: chi riceve l'attestato controlla che sia autentico. */
export default async function VerifyCertificatePage({ params }: Props) {
  const { codice } = await params;
  const cert = await getCertificate(codice);
  if (!cert)
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <CircleX aria-hidden className="size-12 text-negative" />
        <h1 className="text-2xl font-bold">Attestato non trovato</h1>
        <p className="text-ink-muted">
          Il codice <strong className="break-all">{codice}</strong> non corrisponde a nessun
          attestato. Controlla di averlo scritto bene (formato NX-XXXX-XXXX-XXXX).
        </p>
      </section>
    );
  const data = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(new Date(cert.rilasciato_il));
  const ore = formatHours(cert.durata_sec);
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
      <div className="rounded-lg border border-line bg-surface p-8 text-center sm:p-12">
        <BadgeCheck aria-hidden className="mx-auto size-12 text-positive" />
        <p className="mt-4 text-sm font-semibold tracking-[0.16em] text-positive uppercase">
          Attestato autentico
        </p>
        <h1 className="mt-6 text-3xl font-bold">{cert.nome_intestatario}</h1>
        <p className="mt-3 text-ink-muted">ha completato il corso</p>
        <p className="mt-2 text-xl font-semibold">{cert.corso}</p>
        <p className="mt-2 text-sm text-ink-muted">
          {[`${cert.lezioni} lezioni`, ore, cert.docente ? `docente ${cert.docente}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <dl className="mt-8 grid gap-4 border-t border-line pt-6 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-muted">Rilasciato da</dt>
            <dd className="font-semibold">{cert.academy}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Data</dt>
            <dd className="font-semibold">{data}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Codice</dt>
            <dd className="font-semibold break-all">{cert.codice}</dd>
          </div>
        </dl>
        <Button asChild variant="secondary" className="mt-8">
          <a href={`/attestati/${cert.codice}/pdf`}>
            <Download aria-hidden /> Scarica il PDF
          </a>
        </Button>
      </div>
    </section>
  );
}
